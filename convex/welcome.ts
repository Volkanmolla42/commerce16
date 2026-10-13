import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalQuery, mutation } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

// 1. Karşılama e-postası için kullanıcı ve mağaza verilerini getiren internal query
export const getWelcomeEmailData = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.email) return null;

    const storeSettings = await ctx.db.query("storeSettings").first();
    const storeName = storeSettings?.storeName?.trim() || "Mağaza";
    const storeEmail = storeSettings?.email?.trim();
    const siteUrl = env.CART_RECOVERY_SITE_URL || "http://localhost:3000";

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name?.trim() || "",
      },
      storeName,
      storeEmail,
      siteUrl,
    };
  },
});

// 2. Resend üzerinden karşılama e-postasını gönderen internal action
export const sendWelcomeEmailAction = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.welcome.getWelcomeEmailData, {
      userId: args.userId,
    });
    if (!data) return null;

    const { user, storeName, siteUrl } = data;
    const greetingName = user.name ? ` ${user.name}` : "";
    const subject = `✨ ${storeName}'a Hoş Geldiniz${user.name ? `, ${user.name}` : ""}!`;

    const text = [
      `${storeName.toUpperCase()} — AİLEMİZE HOŞ GELDİNİZ!`,
      `----------------------------------------`,
      `Merhaba${greetingName},`,
      ``,
      `Hesabınız başarıyla oluşturuldu. Sizi aramızda görmekten büyük mutluluk duyuyoruz!`,
      ``,
      `Artık hesabınız üzerinden:`,
      `• Siparişlerinizi ve kargo durumunuzu anlık takip edebilir,`,
      `• Beğendiğiniz ürünleri favorilerinize ekleyebilir,`,
      `• Teslimat adreslerinizi kaydederek çok daha hızlı alışveriş yapabilirsiniz.`,
      ``,
      `Koleksiyonlarımızı keşfetmek için sitemizi ziyaret edin:`,
      siteUrl,
      ``,
      `Keyifli alışverişler dileriz!`,
      `— ${storeName} Ekibi`,
    ].join("\n");

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 32px; text-align: center;">
      <div style="display: inline-block; padding: 6px 14px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 9999px; color: #93c5fd; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
        ✨ Ailemize Hoş Geldiniz
      </div>
      <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; line-height: 1.3;">
        ${escapeHtml(storeName)} Dünyasına Hoş Geldiniz!
      </h1>
      <p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 15px;">
        Merhaba${greetingName ? ` <strong>${escapeHtml(user.name)}</strong>` : ""}, hesabınız başarıyla oluşturuldu.
      </p>
    </div>

    <div style="padding: 36px 32px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Sizi aramızda görmekten büyük mutluluk duyuyoruz. Mağazamızda güvenli, hızlı ve keyifli bir alışveriş deneyimi yaşamanız için buradayız.
      </p>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">
          Üyelik Avantajlarınız
        </h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
          <li>Siparişlerinizi ve kargo durumunuzu kolayca takip edin</li>
          <li>Kayıtlı teslimat adreslerinizle tek tıkla hızlı sipariş verin</li>
          <li>Beğendiğiniz ürünleri favorilerinize ekleyin</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 32px 0 24px 0;">
        <a href="${escapeHtml(siteUrl)}" 
           style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);">
          Alışverişe Başla
        </a>
      </div>

      <div style="margin-top: 36px; padding-top: 28px; border-top: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; text-align: center; width: 33.3%;">
              <div style="font-size: 20px; margin-bottom: 6px;">🚀</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">Hızlı Teslimat</div>
              <div style="font-size: 11px; color: #64748b;">Özenli ve güvenli paketleme</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 33.3%;">
              <div style="font-size: 20px; margin-bottom: 6px;">🔒</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">Güvenli Ödeme</div>
              <div style="font-size: 11px; color: #64748b;">256-bit SSL şifreleme</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 33.3%;">
              <div style="font-size: 20px; margin-bottom: 6px;">💬</div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">Müşteri Desteği</div>
              <div style="font-size: 11px; color: #64748b;">Her zaman yanınızdayız</div>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
      &copy; ${escapeHtml(storeName)} — Keyifli Alışverişler Dileriz!
    </div>
  </div>
</body>
</html>`;

    const result = await sendResendEmail({
      to: user.email,
      from: formatSender(storeName),
      subject,
      text,
      html,
      idempotencyKey: `welcome/${args.userId}`,
    });

    await ctx.runMutation(internal.emailTemplates.recordEmailLog, {
      templateKey: "welcome_email",
      recipient: user.email,
      subject,
      htmlBody: html,
      textBody: text,
      status: result.ok ? "sent" : "failed",
      resendId: result.messageId,
      error: result.error,
      metadata: { userId: args.userId },
    });

    return null;
  },
});

// 3. Admin test mutasyonu: İstenen kullanıcıya manuel hoş geldin e-postası tetikleme
export const triggerWelcomeEmailAdmin = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.scheduler.runAfter(0, internal.welcome.sendWelcomeEmailAction, {
      userId: args.userId,
    });
    return null;
  },
});
