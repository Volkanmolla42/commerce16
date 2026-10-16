import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationResultValidator } from "convex/server";
import { getLegalDocuments } from "../lib/legal-documents";
import schema from "./schema";
import { insertAddress } from "./addresses";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";
import { getImagesForVariant } from "../lib/catalog/product-images";
import { components, internal } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";
import type { Id, Doc } from "./_generated/dataModel";
import { getDistrictById, getProvinceById } from "../lib/turkey-provinces";
import { commitCouponReservation, quoteCouponForOrder, releaseCouponReservation, reserveCouponForOrder } from "./coupons";
import { patchCatalogProduct } from "./catalogModel";
import { readPaymentSettings } from "./payments";
import { readStoreSettings } from "./settings";

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

export const listForExportAdmin = query({
  args: {
    adminSecret: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  returns: paginationResultValidator(orderValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.db
      .query("orders")
      .order("desc")
      .paginate({ numItems: Math.min(args.limit ?? 250, 500), cursor: args.cursor });
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
    if (order.userId && (!userId || order.userId !== userId)) {
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
    legalAcceptance: v.optional(v.object({
      accepted: v.literal(true),
      distanceSalesAgreementVersion: v.optional(v.string()),
      preInformationFormVersion: v.optional(v.string()),
    })),
    saveAddress: v.optional(
      schema.doc("addresses").pick("title", "city", "district", "provinceId", "districtId", "addressLine1")
        .extend({ isDefault: v.optional(v.boolean()) })
    ),
    paymentMethod: v.optional(
      v.union(
        v.literal("cash_on_delivery"),
        v.literal("bank_transfer"),
        v.literal("paytr")
      )
    ),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const province = getProvinceById(args.provinceId);
    const district = getDistrictById(args.provinceId, args.districtId);
    if (!province || !district) throw new Error("Türkiye il ve ilçe listesinden geçerli bir adres seçin.");
    const customerName = args.customerName.trim();
    const customerEmail = args.customerEmail.trim();
    if (!customerName || customerName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 120) {
      throw new Error("Geçerli bir ad (en fazla 100 karakter) ve e-posta (en fazla 120 karakter) gereklidir.");
    }
    if (args.customerPhone && args.customerPhone.trim().length > 30) {
      throw new Error("Telefon numarası en fazla 30 karakter olabilir.");
    }
    if (args.shippingAddress && args.shippingAddress.trim().length > 500) {
      throw new Error("Teslimat adresi en fazla 500 karakter olabilir.");
    }
    const storeSettings = await readStoreSettings(ctx);
    let recordedLegalAcceptance = undefined;
    if (args.legalAcceptance) {
      const { distanceSalesAgreement: agreement, preInformationForm: preInformation } =
        getLegalDocuments(storeSettings);
      if (args.legalAcceptance.accepted !== true ||
        (args.legalAcceptance.distanceSalesAgreementVersion && args.legalAcceptance.distanceSalesAgreementVersion !== agreement.version) ||
        (args.legalAcceptance.preInformationFormVersion && args.legalAcceptance.preInformationFormVersion !== preInformation.version)) {
        throw new Error("Yasal belgeler değişti veya onaylanmadı. Sayfayı yenileyip tekrar kontrol edin.");
      }
      recordedLegalAcceptance = {
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
      };
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
    // Aynı varyant birden fazla satırsa stok talebini toplayarak doğrula.
    const reservedDemand = new Map<string, number>();
    for (const item of args.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw new Error("Ürün adedi 1 ile 999 arasında tam sayı olmalı.");
      const productId = ctx.db.normalizeId("products", item.productId);
      const product = productId ? await ctx.db.get(productId) : null;
      if (!product || !product.availableForSale) throw new Error("Sepetinizdeki ürün satışa uygun değil.");
      const variants = product.variants ?? [];
      const variant = item.variantId
        ? variants.find((candidate) => candidate.id === item.variantId)
        : variants.length === 1 ? variants[0] : undefined;
      if (!variant) throw new Error("Ürün seçeneği tükendi veya yetersiz stok.");
      const demandKey = `${product._id}:${variant.id}`;
      const reserved = reservedDemand.get(demandKey) ?? 0;
      if (!variant.availableForSale || variant.stockQuantity < reserved + item.quantity) {
        throw new Error("Ürün seçeneği tükendi veya yetersiz stok.");
      }
      reservedDemand.set(demandKey, reserved + item.quantity);
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

    let paymentMethodTitle: string | undefined = undefined;
    let paymentFee: number | undefined = undefined;
    let additionalFeeCents = 0;

    if (args.paymentMethod) {
      const paymentSettings = await readPaymentSettings(ctx);

      if (args.paymentMethod === "cash_on_delivery") {
        if (!paymentSettings.cashOnDelivery.enabled) {
          throw new Error("Kapıda ödeme yöntemi şu anda aktif değildir.");
        }
        paymentMethodTitle = "Kapıda Ödeme";
        if (paymentSettings.cashOnDelivery.fee > 0) {
          paymentFee = paymentSettings.cashOnDelivery.fee;
          additionalFeeCents = Math.round(paymentFee * 100);
        }
      } else if (args.paymentMethod === "bank_transfer") {
        const { enabled, accounts } = paymentSettings.bankTransfer;
        if (!enabled || accounts.length === 0) {
          throw new Error("Havale / EFT ile ödeme yöntemi şu anda aktif değildir.");
        }
        paymentMethodTitle = "Havale / EFT";
      } else if (args.paymentMethod === "paytr") {
        if (!paymentSettings.paytr.enabled) {
          throw new Error("PayTR ile ödeme yöntemi şu anda aktif değildir.");
        }
        paymentMethodTitle = paymentSettings.paytr.testMode ? "PayTR (Demo)" : "PayTR (Kredi Kartı)";
      }
    }

    const freeShippingThreshold = storeSettings.freeShippingThreshold ?? 0;
    const isFreeShipping = freeShippingThreshold <= 0 || (totalCents / 100) >= freeShippingThreshold;
    const shippingFee = isFreeShipping ? 0 : (storeSettings.shippingFee ?? 0);
    const shippingFeeCents = Math.round(shippingFee * 100);

    const finalPayableCents = payableCents + additionalFeeCents + shippingFeeCents;
    if (!Number.isSafeInteger(finalPayableCents) || Math.abs(Number(args.total) - finalPayableCents / 100) > 0.01) {
      throw new Error("Sepet tutarı değişti. Sepetinizi kontrol edin.");
    }

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
      total: (finalPayableCents / 100).toFixed(2),
      ...(coupon?.valid ? {
        couponId: coupon.couponId,
        couponCode: coupon.code,
        couponDiscountKurus: coupon.discountKurus,
        couponReserved: false,
      } : {}),
      // Oluşturma hiçbir ödeme yönteminde ödeme alınmış saymaz; "paid" yalnız yönetici durum geçişiyle yazılır.
      status: "pending",
      ...(args.paymentMethod ? {
        paymentMethod: args.paymentMethod,
        paymentMethodTitle,
        ...(paymentFee !== undefined ? { paymentFee } : {}),
      } : {}),
      ...(shippingFee > 0 ? { shippingFee } : {}),
      ...(analyticsSessionId ? { analyticsSessionId } : {}),
      shippingAddress: args.shippingAddress,
      ...(recordedLegalAcceptance ? { legalAcceptance: recordedLegalAcceptance } : {}),
    });
    const createdOrder = await ctx.db.get(orderId);
    if (!createdOrder) throw new Error("Sipariş oluşturulamadı.");
    // Stok sipariş anında rezerve edilir; iptal changeOrderStatus üzerinden geri yükler.
    await adjustInventoryForOrder(ctx, createdOrder, -1);
    // Kupon kullanım hakkı da sipariş anında düşülür; iptalde geri iade edilir.
    if (coupon?.valid) await reserveCouponForOrder(ctx, createdOrder);
    await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId });
    await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.markConvertedForOrder, { orderId });

    // Müşteriye sipariş alındı e-postası (havale/EFT veya kapıda ödeme beklenen siparişler dahil)
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event: "order_placed" });
    // Yöneticiye yeni sipariş bildirimi
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event: "admin_order_alert" });

    return orderId;
  },
});

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

async function adjustInventoryForOrder(ctx: MutationCtx, order: Doc<"orders">, direction: -1 | 1) {
  const productDeltas = new Map<string, Map<string, number>>();
  for (const item of order.items) {
    const productId = ctx.db.normalizeId("products", item.productId);
    if (!productId) continue;
    let variantMap = productDeltas.get(productId);
    if (!variantMap) {
      variantMap = new Map();
      productDeltas.set(productId, variantMap);
    }
    const targetKey = item.variantId ?? "";
    variantMap.set(targetKey, (variantMap.get(targetKey) ?? 0) + item.quantity * direction);
  }

  for (const [productId, deltas] of productDeltas) {
    const product = await ctx.db.get(productId as Id<"products">);
    if (!product || !product.variants) continue;
    const nextVariants = product.variants.map((v) => {
      const delta = deltas.get(v.id) ?? (product.variants.length === 1 ? deltas.get("") : undefined);
      if (delta !== undefined) {
        return { ...v, stockQuantity: Math.max(0, v.stockQuantity + delta) };
      }
      return v;
    });
    await patchCatalogProduct(ctx, product, { variants: nextVariants });

    // Stok düşüşü olduğunda kritik stok uyarısı kontrolü
    for (const v of nextVariants) {
      const prevV = product.variants.find((cand) => cand.id === v.id);
      if (prevV && v.stockQuantity < prevV.stockQuantity) {
        await ctx.scheduler.runAfter(0, internal.lowStock.checkLowStockForVariant, {
          productId: product._id,
          variantId: v.id,
          currentStock: v.stockQuantity,
          previousStock: prevV.stockQuantity,
        });
      }
    }
  }
}

async function changeOrderStatus(
  ctx: MutationCtx,
  id: Id<"orders">,
  status: OrderStatus,
  shippingInfo?: { carrier?: string; trackingNumber?: string; trackingUrl?: string }
) {
  const order = await ctx.db.get(id);
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (order.status === status) return null;

  const canceling = order.status !== "cancelled" && status === "cancelled";
  const unCanceling = order.status === "cancelled" && status !== "cancelled";

  if (canceling) {
    await releaseCouponReservation(ctx, order);
    // Stok sipariş oluşturulurken rezerve edilmişti; her iptalde geri yüklenir.
    await adjustInventoryForOrder(ctx, order, 1);
  } else if (unCanceling) {
    // İptal edilen sipariş tekrar aktif duruma alınırsa stok yeniden düşülür.
    await adjustInventoryForOrder(ctx, order, -1);
  }

  if (!canceling && status !== "pending" && status !== "cancelled") {
    await commitCouponReservation(ctx, order);
  }

  const patchData: Record<string, unknown> = {
    status,
    ...(status === "paid" && !order.paidAt ? { paidAt: Date.now() } : {}),
    ...(status === "shipped" && !order.shippedAt ? { shippedAt: Date.now() } : {}),
    ...(status === "delivered" && !order.deliveredAt ? { deliveredAt: Date.now() } : {}),
  };

  if (shippingInfo?.carrier !== undefined) patchData.carrier = shippingInfo.carrier;
  if (shippingInfo?.trackingNumber !== undefined) patchData.trackingNumber = shippingInfo.trackingNumber;
  if (shippingInfo?.trackingUrl !== undefined) patchData.trackingUrl = shippingInfo.trackingUrl;

  await ctx.db.patch(id, patchData);

  if (order.status !== status) {
    await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId: id });
  }

  if (order.status !== "paid" && status === "paid") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "payment_confirmed" });
  }
  if (order.status !== "shipped" && status === "shipped") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_shipped" });
  }
  if (order.status !== "cancelled" && status === "cancelled") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_cancelled" });
  }
  if (order.status !== "delivered" && status === "delivered") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_delivered" });
  }
  return null;
}

export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("orders"),
    status: orderStatusValidator,
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await changeOrderStatus(ctx, args.id, args.status, {
      carrier: args.carrier,
      trackingNumber: args.trackingNumber,
      trackingUrl: args.trackingUrl,
    });
  },
});

// Ödemesi bu süre içinde tamamlanmayan bekleyen siparişler otomatik iptal edilir; rezerve edilen stok geri yüklenir.
const PENDING_ORDER_TTL_MS = 2 * 60 * 60 * 1000;

export const cancelStalePending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PENDING_ORDER_TTL_MS;
    const stale = await ctx.db.query("orders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(100);
    let cancelledCount = 0;
    for (const order of stale) {
      if (order._creationTime < cutoff) {
        await changeOrderStatus(ctx, order._id, "cancelled");
        cancelledCount++;
      }
    }
    if (stale.length === 100 && cancelledCount > 0) {
      await ctx.scheduler.runAfter(0, internal.orders.cancelStalePending, {});
    }
    return null;
  },
});
