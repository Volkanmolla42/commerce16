import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";
import { buildContactFormEmail } from "./emailTemplates";
import { formatDateTime } from "../lib/format-date";
import { formatPhone } from "../lib/orders";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 1. Ziyaretçinin iletişim formu göndermesi
export const submitContactMessage = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.id("contactMessages"),
  }),
  handler: async (ctx, args) => {
    const cleanName = args.name.trim();
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanSubject = args.subject.trim();
    const cleanMessage = args.message.trim();
    const cleanPhone = args.phone?.trim() || undefined;

    if (cleanName.length < 2 || cleanName.length > 100) {
      throw new Error("Lütfen geçerli bir isim giriniz (2-100 karakter).");
    }

    if (!isValidEmail(cleanEmail)) {
      throw new Error("Lütfen geçerli bir e-posta adresi giriniz.");
    }

    if (cleanSubject.length < 2 || cleanSubject.length > 150) {
      throw new Error("Lütfen bir konu belirtiniz (2-150 karakter).");
    }

    if (cleanMessage.length < 5 || cleanMessage.length > 3000) {
      throw new Error("Lütfen en az 5 karakterlik bir mesaj yazınız (maksimum 3000 karakter).");
    }

    // Basit spam önleme: son 60 saniye içinde aynı e-postadan mesaj varsa beklet
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recent = await ctx.db
      .query("contactMessages")
      .withIndex("by_created_at", (q) => q.gt("createdAt", oneMinuteAgo))
      .collect();

    const duplicateInLastMinute = recent.find((m) => m.email === cleanEmail);
    if (duplicateInLastMinute) {
      throw new Error("Kısa süre önce bir mesaj gönderdiniz. Lütfen bir dakika sonra tekrar deneyiniz.");
    }

    const messageId = await ctx.db.insert("contactMessages", {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      status: "new",
      emailSent: false,
      createdAt: now,
    });

    // Yöneticiye anlık e-posta uyarısı tetikle
    await ctx.scheduler.runAfter(0, internal.contact.sendContactAlertAction, {
      messageId,
    });

    return {
      success: true,
      messageId,
    };
  },
});

// 2. Mesaj detaylarını ve mağaza ayarlarını getiren internal query
export const getContactMessageDetails = internalQuery({
  args: {
    messageId: v.id("contactMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    const storeSettings = await ctx.db.query("storeSettings").first();
    const storeName = storeSettings?.storeName?.trim() || "Mağaza";
    const storeEmail = storeSettings?.email?.trim();
    const siteUrl = env.CART_RECOVERY_SITE_URL || "http://localhost:3000";

    return {
      message: {
        _id: message._id,
        name: message.name,
        email: message.email,
        phone: message.phone,
        subject: message.subject,
        message: message.message,
        createdAt: message.createdAt,
      },
      storeName,
      storeEmail,
      siteUrl,
    };
  },
});

// 3. E-posta gönderim sonucunu contactMessages tablosuna işleyen internal mutation
export const recordContactEmailResult = internalMutation({
  args: {
    messageId: v.id("contactMessages"),
    emailSent: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      emailSent: args.emailSent,
      emailError: args.error,
    });
    return null;
  },
});

// 4. Resend üzerinden yöneticiye e-posta gönderen internal action
export const sendContactAlertAction = internalAction({
  args: {
    messageId: v.id("contactMessages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.contact.getContactMessageDetails, {
      messageId: args.messageId,
    });
    if (!data) return null;

    const { message, storeName, storeEmail } = data;
    const toEmail = process.env.ADMIN_ALERT_EMAIL || storeEmail || "delivered@resend.dev";

    const formattedDate = formatDateTime(message.createdAt, {
      dateStyle: "full",
      timeStyle: "short",
    });

    const subject = `📩 Yeni İletişim Mesajı: ${message.subject} (${message.name}) | ${storeName}`;

    // Plain text
    const text = [
      `${storeName.toUpperCase()} — YENİ İLETİŞİM MESAJI`,
      `----------------------------------------`,
      `Tarih: ${formattedDate}`,
      `Gönderen: ${message.name}`,
      `E-posta: ${message.email}`,
      ...(message.phone ? [`Telefon: ${formatPhone(message.phone)}`] : []),
      `Konu: ${message.subject}`,
      ``,
      `Mesaj:`,
      message.message,
      ``,
      `Bu e-postayı doğrudan yanıtlayarak müşteriye geri dönebilirsiniz (Reply-To aktiftir).`,
    ].join("\n");

    // HTML Şablonu
    const html = buildContactFormEmail({
      storeName,
      senderName: message.name,
      senderEmail: message.email,
      senderPhone: message.phone,
      subject: message.subject,
      message: message.message,
      formattedDate,
    });

    const result = await sendResendEmail({
      to: toEmail,
      from: formatSender(storeName),
      replyTo: message.email,
      subject,
      text,
      html,
      idempotencyKey: `contact-msg/${args.messageId}`,
    });

    await ctx.runMutation(internal.contact.recordContactEmailResult, {
      messageId: args.messageId,
      emailSent: result.ok,
      error: result.error,
    });

    await ctx.runMutation(internal.emailTemplates.recordEmailLog, {
      templateKey: "contact_form_alert",
      recipient: toEmail,
      subject,
      htmlBody: html,
      textBody: text,
      status: result.ok ? "sent" : "failed",
      resendId: result.messageId,
      error: result.error,
      metadata: { messageId: args.messageId },
    });

    return null;
  },
});

// 5. Admin için mesajları listeleme query'si
export const listMessagesAdmin = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("contactMessages")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

// 6. Admin mesaj durumunu güncelleme (okundu / yanıtlandı)
export const updateMessageStatusAdmin = mutation({
  args: {
    adminSecret: v.string(),
    messageId: v.id("contactMessages"),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.db.patch(args.messageId, { status: args.status });
    return null;
  },
});
