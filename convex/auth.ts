import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";
import { formatSender, sendResendEmail } from "./mailUtils";
import { buildPasswordResetEmail } from "./emailTemplates";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "email",
        async sendVerificationRequest({ identifier: email, token }) {
          const storeName = "Mağaza";
          const subject = `Şifre Sıfırlama Kodunuz: ${token} | ${storeName}`;

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

          const html = buildPasswordResetEmail({
            storeName,
            token,
          });

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
