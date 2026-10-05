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
      phone: (user as Record<string, unknown>).phone as string | undefined,
      image: user.image,
    };
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

    await ctx.db.patch(userId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.phone !== undefined ? { phone: args.phone } : {}),
    });
    return null;
  },
});
