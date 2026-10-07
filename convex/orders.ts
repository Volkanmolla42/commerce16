import { env, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getCheckoutLegalDocuments } from "../lib/legal-documents";
import schema from "./schema";
import { insertAddress } from "./addresses";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";
import { components, internal } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { hashRiskIdentifier, signedRiskContextValidator, verifyCheckoutRiskContext } from "./paymentRisk";
import type { Id } from "./_generated/dataModel";
import { commitOrderInventory, recordInventoryMovement, releaseOrderInventory, reserveOrderInventory } from "./inventory";
import { getDistrictById, getProvinceById } from "../lib/turkey-provinces";
import { commitCouponReservation, quoteCouponForOrder, releaseCouponReservation } from "./coupons";

const reservationTtl = 30 * 60 * 1000;

const orderRateLimiter = new RateLimiter(components.rateLimiter, {
  orderByEmail: { kind: "fixed window", rate: 4, period: 60 * 60 * 1000 },
  orderByAccount: { kind: "fixed window", rate: 6, period: 60 * 60 * 1000 },
  orderByIp: { kind: "fixed window", rate: 10, period: 60 * 60 * 1000 },
});

const orderValidator = schema.doc("orders");
const customerOrderValidator = orderValidator.omit("checkoutIpEncrypted");
const orderItemValidator = orderValidator.fields.items.element;
const orderStatusValidator = orderValidator.fields.status;

function omitCheckoutIp<T extends { checkoutIpEncrypted?: string }>(order: T) {
  const safeOrder = { ...order };
  delete safeOrder.checkoutIpEncrypted;
  return safeOrder;
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptCheckoutIp(ip: string, orderId: Id<"orders">, secret: string) {
  const encoder = new TextEncoder();
  const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(`commerce-checkout-ip:v1:${secret}`));
  const nonceBytes = await crypto.subtle.digest("SHA-256", encoder.encode(`commerce-checkout-ip-nonce:v1:${orderId}`));
  const iv = new Uint8Array(nonceBytes).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`checkout-ip:${orderId}`) },
    key,
    encoder.encode(ip.slice(0, 64)),
  );
  return `v1.${toHex(iv)}.${toHex(new Uint8Array(ciphertext))}`;
}

export const getMyOrders = query({
  args: {},
  returns: v.array(customerOrderValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return orders.map(omitCheckoutIp);
  },
});

export const getFrequentlyBoughtTogether = query({
  args: { productIds: v.array(v.string()) },
  returns: v.array(v.object({ productId: v.string(), count: v.number() })),
  handler: async (ctx, { productIds }) => {
    if (productIds.length > 10) throw new Error("En fazla 10 ürün için birlikte satın alma önerisi alınabilir.");
    const sourceIds = new Set(productIds.slice(0, 10));
    if (sourceIds.size === 0) return [];

    const orders = await Promise.all(
      (["paid", "shipped", "delivered"] as const).map((status) =>
        ctx.db.query("orders")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(200),
      ),
    );
    const counts = new Map<string, number>();

    for (const order of orders.flat()) {
      const productIdsInOrder = new Set(order.items.map((item) => item.productId));
      if (![...sourceIds].some((id) => productIdsInOrder.has(id))) continue;
      for (const productId of productIdsInOrder) {
        if (!sourceIds.has(productId)) counts.set(productId, (counts.get(productId) ?? 0) + 1);
      }
    }

    return [...counts]
      .map(([productId, count]) => ({ productId, count }))
      .sort((a, b) => b.count - a.count || a.productId.localeCompare(b.productId))
      .slice(0, 20);
  },
});

export const getRecentPurchaseActivity = query({
  args: { productId: v.id("products"), now: v.number() },
  returns: v.object({ buyerCount: v.number(), limited: v.boolean(), expiresAt: v.union(v.number(), v.null()) }),
  handler: async (ctx, { productId, now }) => {
    const day = 24 * 60 * 60 * 1000;
    const since = now - day;
    const recentByStatus = await Promise.all(
      (["paid", "shipped", "delivered"] as const).map((status) =>
        ctx.db.query("orders")
          .withIndex("by_status", (q) => q.eq("status", status).gte("_creationTime", since))
          .order("desc")
          .take(250),
      ),
    );
    const latestPurchaseByBuyer = new Map<string, number>();

    for (const order of recentByStatus.flat()) {
      if (!order.items.some((item) => item.productId === productId)) continue;
      const buyer = order.customerEmail.trim().toLowerCase();
      latestPurchaseByBuyer.set(buyer, Math.max(latestPurchaseByBuyer.get(buyer) ?? 0, order._creationTime));
    }

    const expirations = [...latestPurchaseByBuyer.values()].map((createdAt) => createdAt + day);
    return {
      buyerCount: latestPurchaseByBuyer.size,
      limited: recentByStatus.some((orders) => orders.length === 250),
      expiresAt: expirations.length > 0 ? Math.min(...expirations) : null,
    };
  },
});

export const listAllAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(orderValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.db.query("orders").order("desc").take(100);
  },
});

export const getOrderById = query({
  args: {
    id: v.id("orders"),
  },
  returns: v.union(customerOrderValidator, v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId || order.userId !== userId) {
      return null;
    }

    return omitCheckoutIp(order);
  },
});

export const getOrderForPayment = internalQuery({
  args: { id: v.id("orders"), customerEmail: v.string() },
  returns: v.union(customerOrderValidator, v.null()),
  handler: async (ctx, { id, customerEmail }) => {
    const order = await ctx.db.get(id);
    if (!order) return null;
    const userId = await getAuthUserId(ctx);
    if (order.userId) return userId === order.userId ? omitCheckoutIp(order) : null;
    return order.customerEmail.toLowerCase() === customerEmail.trim().toLowerCase() ? omitCheckoutIp(order) : null;
  },
});

export const getOrderForPaymentInternal = internalQuery({
  args: { id: v.id("orders") },
  returns: v.union(orderValidator, v.null()),
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const createOrder = mutation({
  args: {
    customerEmail: v.string(),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    analyticsSessionId: v.optional(v.string()),
    items: v.array(orderItemValidator),
    total: v.string(),
    couponCode: v.optional(v.string()),
    provinceId: v.string(),
    districtId: v.string(),
    shippingAddress: v.optional(v.string()),
    legalAcceptance: v.object({
      accepted: v.literal(true),
      distanceSalesAgreementVersion: v.string(),
      preInformationFormVersion: v.string(),
    }),
    invoiceRecipient: v.optional(v.object({
      type: v.union(v.literal("individual"), v.literal("business")),
      businessTitle: v.optional(v.string()),
      taxNumber: v.optional(v.string()),
      taxOffice: v.optional(v.string()),
    })),
    riskContext: v.optional(signedRiskContextValidator),
    saveAddress: v.optional(
      schema.doc("addresses").pick("title", "city", "district", "provinceId", "districtId", "addressLine1", "addressLine2", "postalCode")
        .extend({ isDefault: v.optional(v.boolean()) })
    ),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const province = getProvinceById(args.provinceId);
    const district = getDistrictById(args.provinceId, args.districtId);
    if (!province || !district) throw new Error("Türkiye il ve ilçe listesinden geçerli bir adres seçin.");
    if (!args.customerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.customerEmail.trim())) {
      throw new Error("Ad ve geçerli e-posta gereklidir.");
    }
    const { distanceSalesAgreement: agreement, preInformationForm: preInformation } = getCheckoutLegalDocuments();
    if (!agreement.ready || !preInformation.ready) {
      throw new Error("Mesafeli satış sözleşmesi ve ön bilgilendirme formu kodda tamamlanmalı.");
    }
    if (args.legalAcceptance.accepted !== true ||
      args.legalAcceptance.distanceSalesAgreementVersion !== agreement.version ||
      args.legalAcceptance.preInformationFormVersion !== preInformation.version) {
      throw new Error("Yasal belgeler değişti veya onaylanmadı. Sayfayı yenileyip tekrar kontrol edin.");
    }
    if (args.invoiceRecipient?.type === "business" &&
      (!args.invoiceRecipient.businessTitle?.trim() || !/^\d{10}$/.test(args.invoiceRecipient.taxNumber ?? "") || !args.invoiceRecipient.taxOffice?.trim())) {
      throw new Error("Kurumsal fatura için şirket unvanı, 10 haneli vergi numarası ve vergi dairesi gereklidir.");
    }
    const trustedIp = await verifyCheckoutRiskContext(args.riskContext, env.CHECKOUT_RISK_CONTEXT_SECRET);
    if (args.riskContext && !trustedIp) {
      throw new Error("Güvenlik doğrulaması geçersiz veya süresi doldu. Sayfayı yenileyip tekrar deneyin.");
    }
    if (env.CHECKOUT_RISK_CONTEXT_REQUIRED === "true" && !trustedIp) {
      throw new Error("Güvenlik doğrulaması eksik. Sayfayı yenileyip tekrar deneyin.");
    }
    const emailHash = await hashRiskIdentifier(`email:${args.customerEmail.trim().toLowerCase()}`, env.CHECKOUT_RISK_CONTEXT_SECRET);
    const emailLimitKey = trustedIp
      ? await hashRiskIdentifier(`email-ip:${emailHash}:${trustedIp}`, env.CHECKOUT_RISK_CONTEXT_SECRET)
      : emailHash;
    const emailLimit = await orderRateLimiter.limit(ctx, "orderByEmail", { key: emailLimitKey });
    if (!emailLimit.ok) throw new Error("Bu e-posta adresiyle çok sık sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    if (trustedIp) {
      const ipHash = await hashRiskIdentifier(`ip:${trustedIp}`, env.CHECKOUT_RISK_CONTEXT_SECRET);
      const ipLimit = await orderRateLimiter.limit(ctx, "orderByIp", { key: ipHash });
      if (!ipLimit.ok) throw new Error("Bu bağlantıdan kısa sürede çok fazla sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    }
    if (userId) {
      const accountHash = await hashRiskIdentifier(`account:${userId}`, env.CHECKOUT_RISK_CONTEXT_SECRET);
      const accountLimit = await orderRateLimiter.limit(ctx, "orderByAccount", { key: accountHash });
      if (!accountLimit.ok) throw new Error("Hesabınızdan kısa sürede çok fazla sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    }
    if (args.items.length === 0 || args.items.length > 100) throw new Error("Sipariş 1 ile 100 ürün içermeli.");
    const items = [];
    const stockDeductions = new Map<string, {
      productId: Id<"products">;
      variantId?: string;
      quantity: number;
      tracking: "product" | "variant";
    }>();
    let totalCents = 0;
    for (const item of args.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw new Error("Ürün adedi 1 ile 999 arasında tam sayı olmalı.");
      const productId = ctx.db.normalizeId("products", item.productId);
      const product = productId ? await ctx.db.get(productId) : null;
      if (!product || !product.availableForSale) throw new Error("Sepetinizdeki ürün satışa uygun değil.");
      const variants = product.variants ?? [];
      const variant = item.variantId
        ? variants.find((candidate) => candidate.id === item.variantId)
        : variants.length === 1 ? variants[0] : undefined;
      if ((variants.length > 0 && !variant) || (item.variantId && !variant) || (variant && !variant.availableForSale)) throw new Error("Ürün seçeneği satışa uygun değil.");
      const trackedVariantStock = variant?.stockQuantity != null;
      const stockQuantity = trackedVariantStock ? variant.stockQuantity! : product.stockQuantity ?? null;
      const tracking = trackedVariantStock ? "variant" as const : stockQuantity != null ? "product" as const : undefined;
      if (stockQuantity === 0) throw new Error("Ürün seçeneği stokta kalmadı.");
      if (tracking && stockQuantity != null) {
        const key = tracking === "variant" ? `${product._id}:${variant!.id}` : product._id;
        const previousQuantity = stockDeductions.get(key)?.quantity ?? 0;
        if (previousQuantity + item.quantity > stockQuantity) throw new Error("Sipariş miktarı mevcut stok miktarını aşıyor.");
        stockDeductions.set(key, {
          productId: product._id,
          variantId: tracking === "variant" ? variant!.id : undefined,
          quantity: previousQuantity + item.quantity,
          tracking,
        });
      }
      const price = variant?.price ?? product.price;
      if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw new Error("Ürün fiyatı geçersiz.");
      const cents = Math.round(Number(price) * 100);
      if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(totalCents + cents * item.quantity)) throw new Error("Sipariş tutarı geçersiz.");
      if (Number(item.price) !== Number(price)) throw new Error("Sepet fiyatı değişti. Ürünleri yeniden sepete ekleyin.");
      totalCents += cents * item.quantity;
      const storageImage = product.storageImages?.[0];
      const image = product.images[0] ?? (storageImage ? await ctx.storage.getUrl(storageImage.storageId) : null);
      items.push({
        productId: product._id,
        variantId: variant?.id,
        title: variant?.selectedOptions.length
          ? `${product.title} — ${variant.selectedOptions.map(({ value }) => value).join(" / ")}`
          : product.title,
        quantity: item.quantity,
        price: (cents / 100).toFixed(2),
        sku: variant?.sku ?? product.sku,
        vatRate: variant?.vatRate ?? product.vatRate,
        image: image ?? undefined,
        stockTracked: tracking !== undefined,
        stockTracking: tracking,
      });
    }
    const coupon = args.couponCode?.trim()
      ? await quoteCouponForOrder(ctx, args.couponCode, totalCents)
      : undefined;
    const payableCents = coupon?.valid ? coupon.totalKurus : totalCents;
    if (payableCents <= 0) throw new Error("Kupon indirimi sepet toplamını sıfırlıyor; bu ödeme akışında ücretsiz sipariş oluşturulamıyor.");
    const storeSettings = await ctx.db.query("storeSettings").withIndex("by_key", (q) => q.eq("key", "store")).unique();
    const configuredShippingFeeKurus = storeSettings?.shippingFeeKurus ?? 0;
    const freeShippingThresholdKurus = storeSettings?.freeShippingThresholdKurus ?? null;
    const shippingCostKurus = configuredShippingFeeKurus > 0 && freeShippingThresholdKurus !== null && payableCents >= freeShippingThresholdKurus
      ? 0
      : configuredShippingFeeKurus;
    const orderTotalCents = payableCents + shippingCostKurus;
    if (!Number.isSafeInteger(orderTotalCents) || Number(args.total) !== orderTotalCents / 100) throw new Error("Sepet tutarı değişti. Sepetinizi kontrol edin.");

    const analyticsSessionId = args.analyticsSessionId &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(args.analyticsSessionId)
      ? args.analyticsSessionId
      : undefined;

    // 1. Kullanıcı giriş yapmışsa ad-soyad ve telefon bilgisini profiline kaydet / güncelle
    if (userId) {
      const userUpdates: Record<string, string> = {};
      if (args.customerName && args.customerName.trim()) {
        userUpdates.name = args.customerName.trim();
      }
      if (args.customerPhone && args.customerPhone.trim()) {
        userUpdates.phone = args.customerPhone.trim();
      }
      if (Object.keys(userUpdates).length > 0) {
        await ctx.db.patch(userId, userUpdates);
      }

      // 2. Eğer yeni adres girildiyse ve kaydedilmesi istendiyse adres defterine kaydet
      if (args.saveAddress) {
        await insertAddress(ctx, userId, {
          ...args.saveAddress,
          city: province.name,
          district: district.name,
          provinceId: province.id,
          districtId: district.id,
          fullName: args.customerName,
          phone: args.customerPhone ?? "",
          isDefault: args.saveAddress.isDefault ?? false,
        });
      }
    }

    // 3. Siparişi oluştur
    const reservationExpiresAt = Date.now() + reservationTtl;
    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      customerEmail: args.customerEmail.trim(),
      customerName: args.customerName.trim(),
      customerPhone: args.customerPhone?.trim(),
      items,
      total: (orderTotalCents / 100).toFixed(2),
      shippingCostKurus,
      ...(coupon?.valid ? {
        couponId: coupon.couponId,
        couponCode: coupon.code,
        couponDiscountKurus: coupon.discountKurus,
        couponReserved: false,
      } : {}),
      status: "pending",
      inventoryReserved: false,
      reservationExpiresAt,
      city: province.name,
      district: district.name,
      provinceId: province.id,
      districtId: district.id,
      ...(analyticsSessionId ? { analyticsSessionId } : {}),
      shippingAddress: args.shippingAddress,
      legalAcceptance: {
        acceptedAt: Date.now(),
        distanceSalesAgreement: {
          title: agreement.title,
          version: agreement.version,
          body: agreement.body,
        },
        preInformationForm: {
          title: preInformation.title,
          version: preInformation.version,
          body: preInformation.body,
        },
      },
      invoiceRecipient: args.invoiceRecipient,
    });
    if (trustedIp && env.CHECKOUT_RISK_CONTEXT_SECRET) {
      await ctx.db.patch(orderId, {
        checkoutIpEncrypted: await encryptCheckoutIp(trustedIp, orderId, env.CHECKOUT_RISK_CONTEXT_SECRET),
      });
    }
    await ctx.scheduler.runAfter(reservationTtl, internal.orders.expirePendingOrder, {
      orderId,
      reservationExpiresAt,
    });

    return orderId;
  },
});

export const expirePendingOrder = internalMutation({
  args: { orderId: v.id("orders"), reservationExpiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { orderId, reservationExpiresAt }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "pending" || order.reservationExpiresAt !== reservationExpiresAt ||
      reservationExpiresAt > Date.now()) return null;
    const payment = await ctx.db.query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    if (payment?.status === "review" || payment?.status === "paid") return null;
    if (payment && (payment.status === "initializing" || payment.status === "pending")) {
      await ctx.db.patch(payment._id, { status: "failed" });
    }
    await changeOrderStatus(ctx, orderId, "cancelled");
    return null;
  },
});

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

async function changeOrderStatus(ctx: MutationCtx, id: Id<"orders">, status: OrderStatus) {
  const order = await ctx.db.get(id);
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (order.status === status) return null;

  const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
    pending: ["paid", "cancelled"],
    paid: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };
  if (!transitions[order.status].includes(status)) {
    throw new Error("Sipariş bu durumdan seçilen duruma geçirilemiyor.");
  }

  const latestPayment = order.status === "pending" && (status === "paid" || status === "cancelled")
    ? await ctx.db.query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", id))
      .order("desc")
      .first()
    : null;
  if (status === "paid" && latestPayment?.status !== "paid") {
    throw new Error("Ödeme sağlayıcısı onaylamadan sipariş ödenmiş duruma geçirilemez.");
  }
  if (status === "cancelled" && latestPayment && latestPayment.status !== "failed") {
    throw new Error("Ödeme oturumu sonuçlanmadan sipariş iptal edilemez.");
  }

  const canceling = order.status !== "cancelled" && status === "cancelled";
  if (canceling) await releaseCouponReservation(ctx, order);
  if (!canceling && status !== "pending" && status !== "cancelled") {
    await commitCouponReservation(ctx, order);
  }
  if (canceling && order.inventoryReserved) {
    const restockTargets = await releaseOrderInventory(ctx, id);
    for (const target of restockTargets) {
      await ctx.scheduler.runAfter(0, internal.restockNotifications.processRestock, target);
    }
  } else if (canceling && order.inventoryReserved === undefined) {
    const quantities = new Map<string, {
      productId: Id<"products">;
      variantId?: string;
      sku?: string;
      quantity: number;
      tracking: "product" | "variant";
    }>();
    for (const item of order.items) {
      const tracking = item.stockTracking ?? (item.stockTracked ? "product" : undefined);
      if (!tracking) continue;
      const key = tracking === "variant" && item.variantId
        ? `${item.productId}:${item.variantId}`
        : item.productId;
      const previous = quantities.get(key);
      quantities.set(key, {
        productId: item.productId as Id<"products">,
        variantId: tracking === "variant" ? item.variantId : undefined,
        sku: previous?.sku ?? item.sku,
        quantity: (previous?.quantity ?? 0) + item.quantity,
        tracking,
      });
    }

    const restockTargets: Array<{ productId: Id<"products">; variantId: string }> = [];
    for (const item of quantities.values()) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;

      if (item.tracking === "variant" && item.variantId) {
        const variants = product.variants ?? [];
        const index = variants.findIndex((candidate) => candidate.id === item.variantId);
        const variant = variants[index];
        if (!variant || variant.stockQuantity == null) continue;
        const nextQuantity = variant.stockQuantity + item.quantity;
        await ctx.db.patch(product._id, {
          variants: variants.map((candidate, variantIndex) => variantIndex === index
            ? { ...candidate, stockQuantity: nextQuantity }
            : candidate),
          updatedAt: new Date().toISOString(),
        });
        await recordInventoryMovement(ctx, {
          productId: product._id,
          productTitle: product.title,
          variantId: item.variantId,
          sku: item.sku ?? `VARIANT-${product._id}-${item.variantId}`,
          quantityDelta: item.quantity,
          reason: "reservation_release",
          orderId: id,
        });
        if (canceling && variant.stockQuantity === 0 && nextQuantity > 0 && product.availableForSale && variant.availableForSale) {
          restockTargets.push({ productId: product._id, variantId: variant.id });
        }
      } else if (product.stockQuantity != null) {
        await ctx.db.patch(product._id, {
          stockQuantity: product.stockQuantity + item.quantity,
          updatedAt: new Date().toISOString(),
        });
        await recordInventoryMovement(ctx, {
          productId: product._id,
          productTitle: product.title,
          sku: item.sku ?? `PRODUCT-${product._id}`,
          quantityDelta: item.quantity,
          reason: "reservation_release",
          orderId: id,
        });
        if (canceling && product.stockQuantity === 0 && product.availableForSale) {
          const variantIds = (product.variants ?? []).filter((variant) =>
            variant.availableForSale && variant.stockQuantity == null,
          ).map((variant) => variant.id);
          for (const variantId of variantIds) restockTargets.push({ productId: product._id, variantId });
          if (variantIds.length === 0 && (product.variants?.length ?? 0) === 0) {
            restockTargets.push({ productId: product._id, variantId: "" });
          }
        }
      }
    }

    for (const target of restockTargets) {
      await ctx.scheduler.runAfter(0, internal.restockNotifications.processRestock, target);
    }
  }

  if (!canceling && status !== "pending" && status !== "cancelled" && order.inventoryReserved === false) {
    await reserveOrderInventory(ctx, order, Date.now() + reservationTtl);
  }
  if (status !== "pending" && status !== "cancelled" && order.inventoryReserved !== undefined) {
    await commitOrderInventory(ctx, id);
  }

  await ctx.db.patch(id, {
    status,
    ...(status === "paid" && !order.paidAt ? { paidAt: Date.now() } : {}),
  });
  if (order.status !== status) {
    await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId: id });
  }
  if (order.status !== "paid" && status === "paid") {
    await ctx.scheduler.runAfter(0, internal.invoices.issueForOrder, { orderId: id });
    await ctx.scheduler.runAfter(0, internal.shipping.createForPaidOrderScheduled, { orderId: id });
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "payment_confirmation" });
  }
  if (order.status !== "shipped" && status === "shipped") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "shipping_update" });
  }
  return null;
}

export const cancelPendingOrder = internalMutation({
  args: { id: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const order = await ctx.db.get(id);
    if (order?.status === "pending") await changeOrderStatus(ctx, id, "cancelled");
    return null;
  },
});

export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("orders"),
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await changeOrderStatus(ctx, args.id, args.status);
  },
});
