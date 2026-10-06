import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const MAX_FAVORITES = 100;

async function requireUserId(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Favorilerinizi kaydetmek için giriş yapın.");
  return userId;
}

export const getMyFavoriteSlugs = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_FAVORITES);

    return favorites.map(({ productSlug }) => productSlug);
  },
});

export const setMyFavorite = mutation({
  args: {
    productSlug: v.string(),
    isFavorite: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { productSlug, isFavorite }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_and_slug", (q) =>
        q.eq("userId", userId).eq("productSlug", productSlug),
      )
      .unique();

    if (!isFavorite) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", productSlug))
      .first();
    if (!product) throw new Error("Ürün artık bulunamıyor.");

    if (!existing) {
      const favorites = await ctx.db
        .query("favorites")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(MAX_FAVORITES + 1);
      if (favorites.length >= MAX_FAVORITES) {
        throw new Error(`En fazla ${MAX_FAVORITES} ürün favorilere eklenebilir.`);
      }
      await ctx.db.insert("favorites", { userId, productSlug });
    }

    return null;
  },
});

export const mergeMyFavorites = mutation({
  args: { productSlugs: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { productSlugs }) => {
    const userId = await requireUserId(ctx);
    if (productSlugs.length > MAX_FAVORITES) {
      throw new Error(`En fazla ${MAX_FAVORITES} ürün aynı anda aktarılabilir.`);
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_FAVORITES);
    const knownSlugs = new Set(favorites.map(({ productSlug }) => productSlug));
    const acceptedSlugs: string[] = [];

    for (const productSlug of new Set(productSlugs)) {
      const product = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", productSlug))
        .first();
      if (!product) continue;

      if (!knownSlugs.has(productSlug)) {
        if (knownSlugs.size >= MAX_FAVORITES) continue;
        await ctx.db.insert("favorites", { userId, productSlug });
        knownSlugs.add(productSlug);
      }
      acceptedSlugs.push(productSlug);
    }

    return acceptedSlugs;
  },
});
