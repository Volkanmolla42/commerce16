import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalQuery, mutation } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { formatSender, sendResendEmail } from "./mailUtils";
import { buildWelcomeEmail } from "./emailTemplates";

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

    const html = buildWelcomeEmail({
      storeName,
      userName: user.name,
      siteUrl,
    });

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
