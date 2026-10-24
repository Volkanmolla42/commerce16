import { routes } from "../lib/storefront-routes";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { siteLink } from "./emails/config";
import { renderRestockEmail } from "./emails/templates/marketing";
import { sendEmail } from "./emails/send";
import { storeConfig } from "../lib/store-config";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  restockSubscribe: { kind: "fixed window", rate: 10, period: 60 * 60 * 1000 },
});

import { randomHex } from "./random";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanEmail(value: string) {
  const email = value.trim().normalize("NFC").toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Lütfen geçerli bir e-posta adresi girin.");
  }
  return email;
}

// 1. Müşterinin stok bildirimi kaydı oluşturması
export const subscribe = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    email: v.string(),
    consentVersion: v.string(),
    consentedAt: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    alreadySubscribed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const email = cleanEmail(args.email);
    const consentVersion = args.consentVersion.trim();
    if (!consentVersion || consentVersion.length > 40 || !Number.isFinite(args.consentedAt)) {
      throw new Error("Gizlilik onayı kaydedilemedi. Lütfen formu yenileyip tekrar deneyin.");
    }
    const emailHash = await hash(`restock:${email}`);
    await rateLimiter.limit(ctx, "restockSubscribe", { key: emailHash, throws: true });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Ürün bulunamadı.");

    // Varyant kontrolü
    if (args.variantId) {
      const variant = product.variants?.find((v) => v.id === args.variantId);
      if (!variant) throw new Error("Seçilen ürün varyantı bulunamadı.");
      if (variant.availableForSale && (variant.stockQuantity === undefined || variant.stockQuantity > 0)) {
        return {
          ok: true,
          message: "Bu ürün seçeneği şu anda zaten stokta bulunuyor.",
          alreadySubscribed: false,
        };
      }
    } else {
      if (product.availableForSale) {
        const hasStock = product.variants?.some(
          (v) => v.availableForSale && (v.stockQuantity === undefined || v.stockQuantity > 0)
        );
        if (hasStock) {
          return {
            ok: true,
            message: "Bu ürün şu anda zaten stokta bulunuyor.",
            alreadySubscribed: false,
          };
        }
      }
    }

    // Zaten pending kaydı var mı kontrolü (idempotent)
    const existing = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_email_and_product_and_variant_and_status", (q) =>
        q.eq("email", email).eq("productId", args.productId).eq("variantId", args.variantId).eq("status", "pending")
      )
      .first();

    if (existing) {
      return {
        ok: true,
        message: "Bu ürün için stok bildirim kaydınız zaten bulunmaktadır. Ürün stoğa girdiğinde bilgilendirileceksiniz.",
        alreadySubscribed: true,
      };
    }

    const unsubscribeToken = randomHex(32);
    await ctx.db.insert("restockSubscriptions", {
      email,
      productId: args.productId,
      variantId: args.variantId,
      status: "pending",
      unsubscribeToken,
      consentVersion,
      consentedAt: args.consentedAt,
      consentSource: "restock_dialog",
    });

    return {
      ok: true,
      message: "Harika! Ürün tekrar stoğa girdiğinde e-posta ile bilgilendirileceksiniz.",
      alreadySubscribed: false,
    };
  },
});

// 2. Token ile abonelik sorgulama
export const getSubscriptionByToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      id: v.id("restockSubscriptions"),
      productTitle: v.string(),
      productSlug: v.string(),
      email: v.string(),
      status: v.union(v.literal("pending"), v.literal("sending"), v.literal("notified"), v.literal("cancelled")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
    if (!sub) return null;
    const product = await ctx.db.get(sub.productId);
    return {
      id: sub._id,
      productTitle: product?.title ?? "Ürün",
      productSlug: product?.slug ?? "",
      email: sub.email,
      status: sub.status,
    };
  },
});

// 3. Abonelikten çıkma (Unsubscribe)
export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
    if (!sub) {
      return { ok: false, message: "Abonelik kaydı bulunamadı veya daha önce iptal edilmiş." };
    }
    if (sub.status === "cancelled") {
      return { ok: true, message: "Aboneliğiniz zaten iptal edilmiştir." };
    }
    await ctx.db.patch(sub._id, { status: "cancelled" });
    return { ok: true, message: "Stok bildirim aboneliğiniz başarıyla iptal edildi." };
  },
});

// 4. Belirli bir ürün veya varyantın stok yenilenmesini kontrol edip bildirimleri zamanlama
export const triggerRestockCheck = internalMutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.availableForSale) return null;

    // Bekleyen aboneleri topla
    let subs = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_product_and_variant_and_status", (q) =>
        q.eq("productId", args.productId).eq("variantId", args.variantId).eq("status", "pending")
      )
      .take(100);

    // Eğer genel ürün seviyesinde stok geldiyse varyantsız bekleyenleri de ekle
    if (args.variantId) {
      const genericSubs = await ctx.db
        .query("restockSubscriptions")
        .withIndex("by_product_and_variant_and_status", (q) =>
          q.eq("productId", args.productId).eq("variantId", undefined).eq("status", "pending")
        )
        .take(100);
      subs = [...subs, ...genericSubs];
    }

    if (subs.length === 0) return null;

    // Her abone için bildirim gönderme eylemini tetikle
    for (const sub of subs) {
      await ctx.scheduler.runAfter(0, internal.restock.sendRestockEmailAction, {
        subscriptionId: sub._id,
      });
    }
    return null;
  },
});

// 5. Tek bir abone için e-posta gönderen internal action
export const sendRestockEmailAction = internalAction({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runMutation(internal.restock.claimForNotification, {
      subscriptionId: args.subscriptionId,
    });
    if (!data) return null;

    const outcome = await sendEmail(ctx, {
      to: data.sub.email,
      storeName: data.storeName,
      templateKey: "restock_notification",
      content: renderRestockEmail({
        storeName: data.storeName,
        productTitle: data.productTitle,
        variantTitle: data.variantTitle,
        price: data.price,
        productUrl: siteLink(routes.product(data.productSlug)),
        unsubscribeUrl: siteLink(routes.restockUnsubscribe, { token: data.sub.unsubscribeToken }),
      }),
      idempotencyKey: `restock/${data.sub._id}`,
      metadata: { subscriptionId: data.sub._id, productId: data.productId },
    });

    if (outcome === "sent") {
      await ctx.runMutation(internal.restock.markNotified, { subscriptionId: data.sub._id });
    } else {
      await ctx.runMutation(internal.restock.releaseClaim, { subscriptionId: data.sub._id });
    }

    return null;
  },
});

// 6. Bildirim için veriyi topla ve claim et
export const claimForNotification = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.union(
    v.object({
      sub: v.object({
        _id: v.id("restockSubscriptions"),
        email: v.string(),
        unsubscribeToken: v.string(),
      }),
      productId: v.id("products"),
      productTitle: v.string(),
      productSlug: v.string(),
      variantTitle: v.nullable(v.string()),
      price: v.string(),
      storeName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.status !== "pending") return null;

    const product = await ctx.db.get(sub.productId);
    if (!product) return null;

    const variant = sub.variantId
      ? product.variants?.find((candidate) => candidate.id === sub.variantId) ?? null
      : null;

    await ctx.db.patch(sub._id, { status: "sending" });

    return {
      sub: {
        _id: sub._id,
        email: sub.email,
        unsubscribeToken: sub.unsubscribeToken,
      },
      productId: product._id,
      productTitle: product.title,
      productSlug: product.slug,
      variantTitle: variant?.title && variant.title !== "Default Title" ? variant.title : null,
      price: variant?.price ?? product.variants?.[0]?.price ?? String(product.priceValue),
      storeName: storeConfig.name,
    };
  },
});

// 7. Bildirim tamamlandı olarak işaretle
export const markNotified = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (sub && (sub.status === "sending" || sub.status === "pending")) {
      await ctx.db.patch(sub._id, {
        status: "notified",
      });
    }
    return null;
  },
});

export const releaseClaim = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (sub?.status === "sending") {
      await ctx.db.patch(sub._id, { status: "pending" });
    }
    return null;
  },
});
