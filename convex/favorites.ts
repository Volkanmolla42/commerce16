import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

const MAX_FAVORITES = 100;
// Ürün başına favori sayısı indekslenemediği için sınırlı tarama ile sayılır.
const FAVORITE_COUNT_SCAN_LIMIT = 2000;

async function requireUserId(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Favorilerinizi kaydetmek için giriş yapın.");
  return userId;
}

export const getMyFavoriteSlugs = query({  args: {},
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

export const getProductFavoriteCount = query({
  args: { productSlug: v.string() },
  returns: v.object({ count: v.number(), limited: v.boolean() }),
  handler: async (ctx, { productSlug }) => {
    const rows = await ctx.db
      .query("favorites")
      .withIndex("by_product_slug", (q) => q.eq("productSlug", productSlug))
      .take(501);
    return { count: Math.min(rows.length, 500), limited: rows.length > 500 };
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

export const listFavoriteCountsAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(v.object({ slug: v.string(), count: v.number() })),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const favorites = await ctx.db.query("favorites").take(FAVORITE_COUNT_SCAN_LIMIT);
    const counts = new Map<string, number>();
    for (const favorite of favorites) {
      counts.set(favorite.productSlug, (counts.get(favorite.productSlug) ?? 0) + 1);
    }
    return [...counts.entries()].map(([slug, count]) => ({ slug, count }));
  },
});
