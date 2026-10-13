import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";

// Gönderilen e-posta logları listesi
export const listSentEmailsAdmin = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("emailLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

// Tek bir e-posta logunun tam detayını getirme
export const getEmailLogDetailAdmin = query({
  args: {
    adminSecret: v.string(),
    logId: v.id("emailLogs"),
  },
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.db.get(args.logId);
  },
});
