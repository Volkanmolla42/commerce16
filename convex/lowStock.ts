import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { resolveLowStockThreshold } from "./settings";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";
import { buildLowStockAlertEmail } from "./emailTemplates";

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

    const toEmail = process.env.ADMIN_ALERT_EMAIL || info.storeEmail || "delivered@resend.dev";
    const { product, variant, storeName, siteUrl } = info;
    const variantTitle = variant?.title && variant.title !== "Default Title" ? variant.title : null;
    const adminInventoryUrl = `${siteUrl}/admin/products`;

    const subject = `⚠️ Kritik Stok Uyarısı: ${product.title} (${args.currentStock} adet kaldı) | ${storeName}`;

    // Plain text
    const text = [
      `${storeName.toUpperCase()} — KRİTİK STOK UYARISI`,
      `----------------------------------------`,
      `Dikkat: Aşağıdaki ürünün stoğu belirlenen kritik eşiğin altına indi!`,
      ``,
      `Ürün: ${product.title}`,
      ...(variantTitle ? [`Seçenek: ${variantTitle}`] : []),
      `Kalan Stok: ${args.currentStock} adet`,
      `Kritik Eşik Seviyesi: ${args.threshold} adet`,
      ``,
      `Stok durumunu güncellemek için admin panelini ziyaret edin:`,
      adminInventoryUrl,
      ``,
      `Bu bildirim otomatik olarak oluşturulmuştur.`,
    ].join("\n");

    // HTML Şablonu
    const html = buildLowStockAlertEmail({
      storeName,
      productTitle: product.title,
      variantTitle,
      currentStock: args.currentStock,
      threshold: args.threshold,
      adminInventoryUrl,
    });

    const result = await sendResendEmail({
      to: toEmail,
      from: formatSender(storeName),
      subject,
      text,
      html,
      idempotencyKey: `low-stock/${args.productId}/${args.variantId ?? "default"}/${args.currentStock}`,
    });

    if (result.ok) {
      await ctx.runMutation(internal.lowStock.recordAlertSent, {
        productId: args.productId,
        variantId: args.variantId,
        stockQuantity: args.currentStock,
        threshold: args.threshold,
      });
    }

    await ctx.runMutation(internal.emailTemplates.recordEmailLog, {
      templateKey: "low_stock_alert",
      recipient: toEmail,
      subject,
      htmlBody: html,
      textBody: text,
      status: result.ok ? "sent" : "failed",
      resendId: result.messageId,
      error: result.error,
      metadata: { productId: args.productId, variantId: args.variantId },
    });

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
      product: v.object({
        title: v.string(),
        slug: v.string(),
      }),
      variant: v.union(
        v.object({
          id: v.string(),
          title: v.string(),
        }),
        v.null()
      ),
      storeName: v.string(),
      storeEmail: v.optional(v.string()),
      siteUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    const variant = args.variantId
      ? product.variants?.find((v) => v.id === args.variantId) || null
      : null;

    const storeSettings = await ctx.db.query("storeSettings").first();
    const storeName = storeSettings?.storeName?.trim() || "Mağaza";
    const storeEmail = storeSettings?.email?.trim();
    const siteUrl = env.CART_RECOVERY_SITE_URL || "http://localhost:3000";

    return {
      product: {
        title: product.title,
        slug: product.slug,
      },
      variant: variant
        ? {
            id: variant.id,
            title: variant.title,
          }
        : null,
      storeName,
      storeEmail,
      siteUrl,
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

// 5. Test/Manuel tetikleme mutasyonu (Admin paneli veya test için)
export const triggerLowStockAlertAdmin = mutation({
  args: {
    adminSecret: v.string(),
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Ürün bulunamadı.");

    const variant = args.variantId
      ? product.variants?.find((v) => v.id === args.variantId)
      : product.variants?.[0];

    const currentStock = variant?.stockQuantity ?? 1;
    const threshold = await resolveLowStockThreshold(ctx);

    await ctx.scheduler.runAfter(0, internal.lowStock.sendLowStockAlertAction, {
      productId: args.productId,
      variantId: args.variantId,
      currentStock,
      threshold,
    });
    return null;
  },
});

// 6. Admin için gönderilen kritik stok alarmlarını listeleme
export const listAlertsAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.db.query("lowStockAlerts").collect();
  },
});
