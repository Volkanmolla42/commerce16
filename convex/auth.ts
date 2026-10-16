import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtx } from "convex/server";
import { api, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { renderOtpEmail } from "./emails/templates/account";
import { sendEmail } from "./emails/send";

// convex-auth, e-posta sağlayıcısında ctx'i ikinci argüman olarak çalıştırmada veriyor
// ama tip tanımlarında onu açıklamıyor; mağaza adı için runQuery gerekiyor.
async function sendPasswordResetCode(
  { identifier: email, token }: { identifier: string; token: string },
  ctx?: GenericActionCtx<DataModel>
) {
  if (!ctx) throw new Error("Şifre sıfırlama e-postası için bağlantı bağlamı yok.");

  const settings = await ctx.runQuery(api.settings.getStoreSettings, {});
  const outcome = await sendEmail(ctx, {
    to: email,
    storeName: settings.storeName,
    templateKey: "password_reset_otp",
    content: renderOtpEmail({ storeName: settings.storeName, token, purpose: "reset" }),
    replyTo: settings.email || undefined,
  });
  if (outcome !== "sent") {
    throw new Error(`Şifre sıfırlama kodu gönderilemedi: ${outcome}`);
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "email",
        sendVerificationRequest: sendPasswordResetCode,
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
