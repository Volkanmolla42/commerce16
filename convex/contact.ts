import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery, mutation } from "./_generated/server";
import { adminAlertTo } from "./emails/config";
import { renderContactEmail } from "./emails/templates/alerts";
import { sendEmail } from "./emails/send";
import { storeConfig } from "../lib/store-config";

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
    consentVersion: v.string(),
    consentedAt: v.number(),
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
    const consentVersion = args.consentVersion.trim();
    if (!consentVersion || consentVersion.length > 40 || !Number.isFinite(args.consentedAt)) {
      throw new Error("Gizlilik onayı kaydedilemedi. Lütfen formu yenileyip tekrar deneyin.");
    }

    // Basit spam önleme: son 60 saniye içinde aynı e-postadan mesaj varsa beklet
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const duplicateInLastMinute = await ctx.db
      .query("contactMessages")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail).gt("_creationTime", oneMinuteAgo))
      .first();
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
      consentVersion,
      consentedAt: args.consentedAt,
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

// 2. Mesaj detaylarını ve mağaza adını getiren internal query
export const getContactMessageDetails = internalQuery({
  args: {
    messageId: v.id("contactMessages"),
  },
  returns: v.union(
    v.object({
      message: v.object({
        name: v.string(),
        email: v.string(),
        phone: v.nullable(v.string()),
        subject: v.string(),
        message: v.string(),
        _creationTime: v.number(),
      }),
      storeName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    return {
      message: {
        name: message.name,
        email: message.email,
        phone: message.phone ?? null,
        subject: message.subject,
        message: message.message,
        _creationTime: message._creationTime,
      },
      storeName: storeConfig.name,
    };
  },
});

// 3. Yöneticiye iletişim mesajı bildirimini gönderen internal action
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

    const { message, storeName } = data;
    await sendEmail(ctx, {
      to: adminAlertTo(),
      storeName,
      templateKey: "contact_form_alert",
      content: renderContactEmail({
        storeName,
        senderName: message.name,
        senderEmail: message.email,
        senderPhone: message.phone,
        messageSubject: message.subject,
        message: message.message,
        _creationTime: message._creationTime,
      }),
      replyTo: message.email,
      idempotencyKey: `contact/${args.messageId}`,
      metadata: { messageId: args.messageId },
    });

    return null;
  },
});
