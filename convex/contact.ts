import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

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

    const formattedDate = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(message.createdAt));

    const subject = `📩 Yeni İletişim Mesajı: ${message.subject} (${message.name}) | ${storeName}`;

    // Plain text
    const text = [
      `${storeName.toUpperCase()} — YENİ İLETİŞİM MESAJI`,
      `----------------------------------------`,
      `Tarih: ${formattedDate}`,
      `Gönderen: ${message.name}`,
      `E-posta: ${message.email}`,
      ...(message.phone ? [`Telefon: ${message.phone}`] : []),
      `Konu: ${message.subject}`,
      ``,
      `Mesaj:`,
      message.message,
      ``,
      `Bu e-postayı doğrudan yanıtlayarak müşteriye geri dönebilirsiniz (Reply-To aktiftir).`,
    ].join("\n");

    // HTML Şablonu
    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
    <tr>
      <td>
        <!-- Üst Başlık Barı -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f172a;color:#ffffff;padding:24px 32px;">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px;">
                📬 MÜŞTERİ İLETİŞİM FORMU
              </div>
              <h1 style="margin:0;font-size:20px;font-weight:700;line-height:1.3;color:#ffffff;">
                Yeni İletişim Formu Mesajı
              </h1>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                ${escapeHtml(formattedDate)}
              </div>
            </td>
          </tr>
        </table>

        <!-- İçerik Alanı -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px;">
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <!-- Gönderen Bilgileri Kartı -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;">
                      <tr>
                        <td style="width:100px;color:#64748b;font-weight:600;padding:4px 0;">Gönderen:</td>
                        <td style="color:#0f172a;font-weight:700;padding:4px 0;">${escapeHtml(message.name)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-weight:600;padding:4px 0;">E-posta:</td>
                        <td style="padding:4px 0;">
                          <a href="mailto:${escapeHtml(message.email)}" style="color:#2563eb;text-decoration:none;font-weight:600;">
                            ${escapeHtml(message.email)}
                          </a>
                        </td>
                      </tr>
                      ${message.phone ? `
                      <tr>
                        <td style="color:#64748b;font-weight:600;padding:4px 0;">Telefon:</td>
                        <td style="color:#0f172a;padding:4px 0;">${escapeHtml(message.phone)}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="color:#64748b;font-weight:600;padding:4px 0;">Konu:</td>
                        <td style="color:#0f172a;font-weight:600;padding:4px 0;">${escapeHtml(message.subject)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Mesaj Gövdesi -->
              <div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#475569;margin-bottom:8px;letter-spacing:0.5px;">
                Mesaj İçeriği:
              </div>
              <div style="background-color:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:20px;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;margin-bottom:24px;">${escapeHtml(message.message)}</div>

              <!-- Hızlı Yanıt Bilgisi -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;">
                <tr>
                  <td>
                    <div style="font-size:13px;color:#1e40af;line-height:1.5;">
                      💡 <strong>İpucu:</strong> Bu e-postaya "Yanıtla" (Reply) diyerek doğrudan müşteriye e-posta cevabınızı iletebilirsiniz.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alt Bilgi -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
              © ${escapeHtml(storeName)} — İletişim Formu Bildirim Servisi
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

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
