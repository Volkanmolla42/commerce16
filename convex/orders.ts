import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getCheckoutLegalDocuments } from "../lib/legal-documents";
import schema from "./schema";
import { insertAddress } from "./addresses";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";
import { getImagesForVariant } from "../lib/catalog/product-images";
import { components, internal } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";
import type { Id } from "./_generated/dataModel";
import { getDistrictById, getProvinceById } from "../lib/turkey-provinces";
import { commitCouponReservation, quoteCouponForOrder, releaseCouponReservation } from "./coupons";

const orderRateLimiter = new RateLimiter(components.rateLimiter, {
  orderByEmail: { kind: "fixed window", rate: 4, period: 60 * 60 * 1000 },
  orderByAccount: { kind: "fixed window", rate: 6, period: 60 * 60 * 1000 },
  orderByIp: { kind: "fixed window", rate: 10, period: 60 * 60 * 1000 },
});

const orderValidator = schema.doc("orders");
const customerOrderValidator = orderValidator;
const orderItemValidator = orderValidator.fields.items.element;
const orderStatusValidator = orderValidator.fields.status;

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

    return orders;
  },
});

export const getFrequentlyBoughtTogether = query({
  args: { productIds: v.array(v.string()) },
  returns: v.array(v.object({ productId: v.string(), count: v.number() })),
  handler: async (ctx, { productIds }) => {
    if (productIds.length > 10) throw new Error("En fazla 10 ürün için birlikte satın alma önerisi alınabilir.");
    const sourceIds = new Set(productIds.slice(0, 10));
    if (sourceIds.size === 0) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "paid"))
      .order("desc")
      .take(200);
    const counts = new Map<string, number>();

    for (const order of orders) {
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
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "paid").gte("_creationTime", since))
      .order("desc")
      .take(250);
    const latestPurchaseByBuyer = new Map<string, number>();

    for (const order of recentOrders) {
      if (!order.items.some((item) => item.productId === productId)) continue;
      const buyer = order.customerEmail.trim().toLowerCase();
      latestPurchaseByBuyer.set(buyer, Math.max(latestPurchaseByBuyer.get(buyer) ?? 0, order._creationTime));
    }

    const expirations = [...latestPurchaseByBuyer.values()].map((createdAt) => createdAt + day);
    return {
      buyerCount: latestPurchaseByBuyer.size,
      limited: recentOrders.length === 250,
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

    return order;
  },
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
    saveAddress: v.optional(
      schema.doc("addresses").pick("title", "city", "district", "provinceId", "districtId", "addressLine1")
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
    const emailKey = args.customerEmail.trim().toLowerCase();
    const emailLimit = await orderRateLimiter.limit(ctx, "orderByEmail", { key: emailKey });
    if (!emailLimit.ok) throw new Error("Bu e-posta adresiyle çok sık sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    if (userId) {
      const accountLimit = await orderRateLimiter.limit(ctx, "orderByAccount", { key: userId });
      if (!accountLimit.ok) throw new Error("Hesabınızdan kısa sürede çok fazla sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    }
    if (args.items.length === 0 || args.items.length > 100) throw new Error("Sipariş 1 ile 100 ürün içermeli.");
    const items = [];
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
      const price = variant!.price;
      if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw new Error("Ürün fiyatı geçersiz.");
      const cents = Math.round(Number(price) * 100);
      if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(totalCents + cents * item.quantity)) throw new Error("Sipariş tutarı geçersiz.");
      if (Number(item.price) !== Number(price)) throw new Error("Sepet fiyatı değişti. Ürünleri yeniden sepete ekleyin.");
      totalCents += cents * item.quantity;
      const imageRecord = getImagesForVariant(product.images, variant!.selectedOptions)[0];
      const image = imageRecord ? await ctx.storage.getUrl(imageRecord.storageId) : null;
      items.push({
        productId: product._id,
        variantId: variant?.id,
        title: variant?.selectedOptions.length
          ? `${product.title} — ${variant.selectedOptions.map(({ value }) => value).join(" / ")}`
          : product.title,
        quantity: item.quantity,
        price: (cents / 100).toFixed(2),
        sku: variant?.sku,
        image: image ?? undefined,
      });
    }
    const coupon = args.couponCode?.trim()
      ? await quoteCouponForOrder(ctx, args.couponCode, totalCents)
      : undefined;
    const payableCents = coupon?.valid ? coupon.totalKurus : totalCents;
    if (payableCents <= 0) throw new Error("Kupon indirimi sepet toplamını sıfırlıyor; bu ödeme akışında ücretsiz sipariş oluşturulamıyor.");
    if (!Number.isSafeInteger(payableCents) || Number(args.total) !== payableCents / 100) throw new Error("Sepet tutarı değişti. Sepetinizi kontrol edin.");

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
    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      customerEmail: args.customerEmail.trim(),
      customerName: args.customerName.trim(),
      customerPhone: args.customerPhone?.trim(),
      items,
      total: (payableCents / 100).toFixed(2),
      ...(coupon?.valid ? {
        couponId: coupon.couponId,
        couponCode: coupon.code,
        couponDiscountKurus: coupon.discountKurus,
        couponReserved: false,
      } : {}),
      status: "pending",
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
    });
    if (coupon?.valid) {
      const createdOrder = await ctx.db.get(orderId);
      if (createdOrder) await commitCouponReservation(ctx, createdOrder);
    }
    await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId });
    await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.markConvertedForOrder, { orderId });

    return orderId;
  },
});

type OrderStatus = "pending" | "paid" | "cancelled";

async function changeOrderStatus(ctx: MutationCtx, id: Id<"orders">, status: OrderStatus) {
  const order = await ctx.db.get(id);
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (order.status === status) return null;

  const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
    pending: ["paid", "cancelled"],
    paid: ["cancelled"],
    cancelled: [],
  };
  if (!transitions[order.status].includes(status)) {
    throw new Error("Sipariş bu durumdan seçilen duruma geçirilemiyor.");
  }

  const canceling = order.status !== "cancelled" && status === "cancelled";
  if (canceling) await releaseCouponReservation(ctx, order);
  if (!canceling && status !== "pending" && status !== "cancelled") {
    await commitCouponReservation(ctx, order);
  }

  await ctx.db.patch(id, {
    status,
    ...(status === "paid" && !order.paidAt ? { paidAt: Date.now() } : {}),
  });
  if (order.status !== status) {
    await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId: id });
  }
  if (order.status !== "paid" && status === "paid") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "payment_confirmation" });
  }
  return null;
}

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
