import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { resolveLowStockThreshold } from "./settings";
import { storeConfig } from "../lib/store-config";
import { adminAlertTo, adminLink } from "./emails/config";
import { renderLowStockEmail } from "./emails/templates/alerts";
import { sendEmail } from "./emails/send";

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 saat spam koruması

// 1. Varyant veya ürün stoğu düştüğünde eşik kontrolü yapıp zamanlama
export const checkLowStockForVariant = internalMutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    currentStock: v.number(),
    previousStock: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threshold = await resolveLowStockThreshold(ctx);

    // Eğer stok kritik eşiğe indiyse (ve 0'dan büyükse)
    if (args.currentStock > 0 && args.currentStock <= threshold) {
      const existing = await ctx.db
        .query("lowStockAlerts")
        .withIndex("by_product_and_variant", (q) =>
          q.eq("productId", args.productId).eq("variantId", args.variantId)
        )
        .first();

      const now = Date.now();
      // Eğer daha önce hiç gönderilmediyse veya cooldown süresi dolduysa ya da stok daha da düştüyse
      if (!existing || now - existing.sentAt > ALERT_COOLDOWN_MS || existing.stockQuantity > args.currentStock) {
        await ctx.scheduler.runAfter(0, internal.lowStock.sendLowStockAlertAction, {
          productId: args.productId,
          variantId: args.variantId,
          currentStock: args.currentStock,
          threshold,
        });
      }
    }

    return null;
  },
});

// 2. Yöneticiye e-posta gönderen internal action
export const sendLowStockAlertAction = internalAction({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    currentStock: v.number(),
    threshold: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const info = await ctx.runQuery(internal.lowStock.getAlertDetails, {
      productId: args.productId,
      variantId: args.variantId,
    });
    if (!info) return null;

    const { productTitle, variantTitle, storeName } = info;
    const outcome = await sendEmail(ctx, {
      to: adminAlertTo(),
      storeName,
      templateKey: "low_stock_alert",
      content: renderLowStockEmail({
        storeName,
        productTitle,
        variantTitle,
        currentStock: args.currentStock,
        threshold: args.threshold,
        adminInventoryUrl: adminLink("stok"),
      }),
      idempotencyKey: `low-stock/${args.productId}/${args.variantId ?? "default"}/${args.currentStock}`,
      metadata: { productId: args.productId, variantId: args.variantId ?? null },
    });

    if (outcome === "sent") {
      await ctx.runMutation(internal.lowStock.recordAlertSent, {
        productId: args.productId,
        variantId: args.variantId,
        stockQuantity: args.currentStock,
        threshold: args.threshold,
      });
    }

    return null;
  },
});

// 3. Bildirim detaylarını sorgulayan internal query
export const getAlertDetails = internalQuery({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      productTitle: v.string(),
      variantTitle: v.nullable(v.string()),
      storeName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    const variant = args.variantId
      ? product.variants?.find((candidate) => candidate.id === args.variantId) || null
      : null;

    return {
      productTitle: product.title,
      variantTitle: variant?.title && variant.title !== "Default Title" ? variant.title : null,
      storeName: storeConfig.name,
    };
  },
});

// 4. Gönderilen uyarının kaydını güncelleyen internal mutation
export const recordAlertSent = internalMutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    stockQuantity: v.number(),
    threshold: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lowStockAlerts")
      .withIndex("by_product_and_variant", (q) =>
        q.eq("productId", args.productId).eq("variantId", args.variantId)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        stockQuantity: args.stockQuantity,
        threshold: args.threshold,
        sentAt: now,
      });
    } else {
      await ctx.db.insert("lowStockAlerts", {
        productId: args.productId,
        variantId: args.variantId,
        stockQuantity: args.stockQuantity,
        threshold: args.threshold,
        sentAt: now,
      });
    }

    return null;
  },
});
