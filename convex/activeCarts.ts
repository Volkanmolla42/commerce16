import { v } from "convex/values";
import { internal, components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { assertAdminApiSecret } from "./adminAuth";
import { MAX_CART_QUANTITY, isVariantSellable } from "../lib/catalog/variants";
import { enrichCartItems, type EnrichedCartItem } from "./cartAdmin";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  sync: { kind: "fixed window", rate: 30, period: 60 * 1000 },
  globalSyncInserts: { kind: "fixed window", rate: 120, period: 60 * 1000 },
});

const activeCartItemValidator = v.object({
  productId: v.id("products"),
  variantId: v.optional(v.string()),
  quantity: v.number(),
});

const enrichedItemValidator = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  quantity: v.number(),
  title: v.string(),
  variantTitle: v.optional(v.string()),
  price: v.string(),
  image: v.optional(v.string()),
});

export const sync = mutation({
  args: {
    sessionKey: v.string(),
    items: v.array(activeCartItemValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{32,64}$/i.test(args.sessionKey)) throw new Error("Sepet oturumu geçersiz.");
    if (args.items.length > 100) throw new Error("Sepet en fazla 100 ürün içerebilir.");
    await rateLimiter.limit(ctx, "sync", { key: args.sessionKey, throws: true });

    const existing = await ctx.db.query("activeCarts")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", args.sessionKey))
      .unique();

    if (args.items.length === 0) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const itemMap = new Map<string, { productId: typeof args.items[number]["productId"]; variantId?: string; quantity: number }>();

    for (const item of args.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_CART_QUANTITY) {
        continue;
      }
      const product = await ctx.db.get(item.productId);
      if (!product || !product.availableForSale) continue;
      const variants = product.variants ?? [];
      const variantId = item.variantId ?? (variants.length === 1 ? variants[0].id : undefined);
      if (variants.length > 0 && !variantId) continue;
      const variant = variantId ? variants.find((candidate) => candidate.id === variantId) : undefined;
      if (variantId && (!variant || !isVariantSellable(variant))) continue;

      const key = `${item.productId}:${variantId ?? ""}`;
      const previous = itemMap.get(key);
      const totalRequested = (previous?.quantity ?? 0) + item.quantity;
      if (totalRequested > MAX_CART_QUANTITY) continue;
      const finalQuantity = variant ? Math.min(totalRequested, variant.stockQuantity) : totalRequested;
      if (finalQuantity <= 0) continue;
      itemMap.set(key, { productId: item.productId, ...(variantId ? { variantId } : {}), quantity: finalQuantity });
    }

    if (itemMap.size === 0) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const now = Date.now();
    const value = {
      items: [...itemMap.values()],
      updatedAt: now,
      expiresAt: now + 48 * 60 * 60 * 1000,
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
    } else {
      await rateLimiter.limit(ctx, "globalSyncInserts", { key: "global", throws: true });
      await ctx.db.insert("activeCarts", { sessionKey: args.sessionKey, ...value });
    }
    return null;
  },
});

export const getProductCartCount = query({
  args: { productId: v.id("products"), now: v.number() },
  returns: v.object({ count: v.number(), limited: v.boolean() }),
  handler: async (ctx, { productId, now }) => {
    const carts = await ctx.db
      .query("activeCarts")
      .withIndex("by_expires_at", (q) => q.gt("expiresAt", now))
      .take(501);
    const matching = carts.filter((cart) => cart.items.some((item) => item.productId === productId));
    return { count: Math.min(matching.length, 500), limited: carts.length > 500 };
  },
});

export const listAdmin = query({
  args: { adminSecret: v.string(), now: v.number() },
  returns: v.array(v.object({
    _id: v.id("activeCarts"),
    _creationTime: v.number(),
    sessionKey: v.string(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    itemCount: v.number(),
    estimatedTotal: v.string(),
    items: v.array(enrichedItemValidator),
  })),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const carts = await ctx.db.query("activeCarts")
      .withIndex("by_updated_at")
      .order("desc")
      .take(100);
    const results: Array<{
      _id: (typeof carts)[number]["_id"];
      _creationTime: number;
      sessionKey: string;
      updatedAt: number;
      expiresAt: number;
      itemCount: number;
      estimatedTotal: string;
      items: EnrichedCartItem[];
    }> = [];
    for (const cart of carts) {
      if (cart.expiresAt <= args.now) continue;
      const { items, itemCount, estimatedTotal } = await enrichCartItems(ctx, cart.items);
      results.push({
        _id: cart._id,
        _creationTime: cart._creationTime,
        sessionKey: cart.sessionKey,
        updatedAt: cart.updatedAt,
        expiresAt: cart.expiresAt,
        itemCount,
        estimatedTotal,
        items,
      });
    }
    return results;
  },
});

export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db.query("activeCarts")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const cart of expired) await ctx.db.delete(cart._id);
    if (expired.length === 100) await ctx.scheduler.runAfter(0, internal.activeCarts.purgeExpired, {});
    return null;
  },
});
