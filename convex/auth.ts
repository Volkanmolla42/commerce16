import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "email",
        async sendVerificationRequest({ identifier: email, token }) {
          const storeName = "Mağaza";
          const subject = `🔐 Şifre Sıfırlama Kodunuz: ${token} | ${storeName}`;

          const text = [
            `${storeName.toUpperCase()} — ŞİFRE SIFIRLAMA`,
            `----------------------------------------`,
            `Hesabınız için bir şifre sıfırlama talebinde bulunuldu.`,
            ``,
            `Tek Kullanımlık Doğrulama Kodunuz:`,
            `>>> ${token} <<<`,
            ``,
            `Bu kod güvenlik nedeniyle sınırlı bir süre için geçerlidir.`,
            `Kodu kimseyle paylaşmayınız.`,
            ``,
            `Bu talebi siz yapmadıysanız lütfen bu e-postayı dikkate almayınız. Hesabınız güvendedir.`,
          ].join("\n");

          const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: center;">
      <div style="display: inline-block; padding: 6px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 9999px; color: #fca5a5; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
        Güvenlik Doğrulaması
      </div>
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
        Şifre Sıfırlama Kodu
      </h1>
      <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 14px;">
        ${escapeHtml(storeName)} Hesabınız
      </p>
    </div>

    <div style="padding: 32px 28px; text-align: center;">
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155;">
        Hesabınızın şifresini yenilemek için talepte bulundunuz. Aşağıdaki tek kullanımlık doğrulama kodunu ekrandaki alana giriniz:
      </p>

      <div style="margin: 24px auto; padding: 16px 32px; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; display: inline-block;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a;">
          ${escapeHtml(token)}
        </span>
      </div>

      <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        ⏱️ Bu kod <strong>güvenliğiniz için sınırlı süreyle</strong> geçerlidir.<br />
        Lütfen bu kodu kimseyle paylaşmayınız.
      </p>

      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: left; background-color: #fef2f2; border-radius: 8px; padding: 14px 16px;">
        <p style="margin: 0; font-size: 12px; color: #991b1b; line-height: 1.5;">
          ⚠️ <strong>Önemli:</strong> Bu talebi siz gerçekleştirmediyseniz, hiçbir işlem yapmanıza gerek yoktur. Mevcut şifreniz geçerliliğini korumaktadır.
        </p>
      </div>
    </div>

    <div style="padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
      &copy; ${escapeHtml(storeName)} — Güvenli Alışveriş
    </div>
  </div>
</body>
</html>`;

          const result = await sendResendEmail({
            to: email,
            from: formatSender(storeName),
            subject,
            text,
            html,
          });

          if (!result.ok) {
            console.error("Şifre sıfırlama OTP gönderim hatası:", result.error);
          } else {
            console.log("Şifre sıfırlama OTP kodu başarıyla gönderildi:", result.messageId);
          }
        },
      }),
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      if (args.existingUserId === null) {
        // Yeni kullanıcı oluşturulduğunda hoş geldin e-postası tetikle
        await ctx.scheduler.runAfter(0, internal.welcome.sendWelcomeEmailAction, {
          userId: args.userId,
        });
      }
    },
  },
});
