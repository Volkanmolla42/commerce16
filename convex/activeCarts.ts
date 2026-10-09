import { v } from "convex/values";
import { internal, components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { assertAdminApiSecret } from "./adminAuth";
import { getImagesForVariant } from "../lib/catalog/product-images";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  sync: { kind: "fixed window", rate: 30, period: 60 * 1000 },
});

const activeCartItemValidator = v.object({
  productId: v.id("products"),
  variantId: v.optional(v.string()),
  quantity: v.number(),
});

const enrichedItemValidator = v.object({
  productId: v.id("products"),
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
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
        throw new Error("Sepetteki ürün adedi geçersiz.");
      }
      const product = await ctx.db.get(item.productId);
      if (!product || !product.availableForSale) throw new Error("Sepetinizde satışta olmayan bir ürün var.");
      const variants = product.variants ?? [];
      const variantId = item.variantId ?? (variants.length === 1 ? variants[0].id : undefined);
      if (variants.length > 0 && !variantId) throw new Error("Sepetinizde ürün seçeneği eksik.");
      const variant = variantId ? variants.find((candidate) => candidate.id === variantId) : undefined;
      if (variantId && (!variant || !variant.availableForSale)) throw new Error("Sepetinizde satışta olmayan bir ürün seçeneği var.");

      const key = `${item.productId}:${variantId ?? ""}`;
      const previous = itemMap.get(key);
      const quantity = (previous?.quantity ?? 0) + item.quantity;
      if (quantity > 999) throw new Error("Ürün adedi izin verilen sınırı aşıyor.");
      itemMap.set(key, { productId: item.productId, ...(variantId ? { variantId } : {}), quantity });
    }

    const now = Date.now();
    const value = {
      items: [...itemMap.values()],
      updatedAt: now,
      expiresAt: now + 48 * 60 * 60 * 1000,
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("activeCarts", { sessionKey: args.sessionKey, ...value });
    return null;
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
      items: Array<{
        productId: (typeof carts)[number]["items"][number]["productId"];
        variantId?: string;
        quantity: number;
        title: string;
        variantTitle?: string;
        price: string;
        image?: string;
      }>;
    }> = [];
    for (const cart of carts) {
      if (cart.expiresAt <= args.now) continue;
      let itemCount = 0;
      let total = 0;
      const items = [];
      for (const item of cart.items) {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId ? product?.variants?.find((candidate) => candidate.id === item.variantId) : undefined;
        const price = variant?.price ?? "0.00";
        itemCount += item.quantity;
        total += (Number.parseFloat(price) || 0) * item.quantity;
        const imageRecord = product ? getImagesForVariant(product.images, variant?.selectedOptions ?? [])[0] : undefined;
        const image = imageRecord ? await ctx.storage.getUrl(imageRecord.storageId) : null;
        items.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          title: product?.title ?? "Silinmiş ürün",
          variantTitle: variant?.title,
          price,
          image: image ?? undefined,
        });
      }
      results.push({
        _id: cart._id,
        _creationTime: cart._creationTime,
        sessionKey: cart.sessionKey,
        updatedAt: cart.updatedAt,
        expiresAt: cart.expiresAt,
        itemCount,
        estimatedTotal: total.toFixed(2),
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
