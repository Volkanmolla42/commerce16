import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { siteUrl } from "./emails/config";
import { renderWelcomeEmail } from "./emails/templates/account";
import { sendEmail } from "./emails/send";
import { storeConfig } from "../lib/store-config";

// 1. Karşılama e-postası için kullanıcı ve mağaza verilerini getiren internal query
export const getWelcomeEmailData = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.nullable(v.string()),
      storeName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.email) return null;

    return {
      email: user.email,
      name: user.name?.trim() || null,
      storeName: storeConfig.name,
    };
  },
});

// 2. Hoş geldin e-postasını gönderen internal action
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

    await sendEmail(ctx, {
      to: data.email,
      storeName: data.storeName,
      templateKey: "welcome_email",
      content: renderWelcomeEmail({
        storeName: data.storeName,
        userName: data.name,
        siteUrl: siteUrl(),
      }),
      idempotencyKey: `welcome/${args.userId}`,
      metadata: { userId: args.userId },
    });

    return null;
  },
});
