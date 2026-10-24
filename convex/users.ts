import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyProfile = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      image: user.image,
    };
  },
});

export const acceptTerms = mutation({
  args: {
    termsVersion: v.string(),
    privacyVersion: v.string(),
    acceptedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");
    const termsVersion = args.termsVersion.trim();
    const privacyVersion = args.privacyVersion.trim();
    if (!termsVersion || termsVersion.length > 40 || !privacyVersion || privacyVersion.length > 40 || !Number.isFinite(args.acceptedAt)) {
      throw new Error("Onay bilgileri geçersiz.");
    }
    const existing = await ctx.db
      .query("legalAcceptances")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        termsVersion,
        privacyVersion,
        acceptedAt: args.acceptedAt,
      });
    } else {
      await ctx.db.insert("legalAcceptances", {
        userId,
        termsVersion,
        privacyVersion,
        acceptedAt: args.acceptedAt,
      });
    }
    return null;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");

    const name = args.name?.trim();
    const phone = args.phone?.trim();
    if (name !== undefined && name.length > 100) {
      throw new Error("İsim en fazla 100 karakter olabilir.");
    }
    if (phone !== undefined && phone.length > 30) {
      throw new Error("Telefon en fazla 30 karakter olabilir.");
    }

    await ctx.db.patch(userId, {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });
    return null;
  },
});
