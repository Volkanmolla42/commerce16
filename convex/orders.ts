import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationResultValidator } from "convex/server";
import { getLegalDocuments, TERMS_VERSION } from "../lib/legal-documents";
import schema from "./schema";
import { insertAddress } from "./addresses";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";
import { resolveVariantImageUrl } from "./productMedia";
import { components, internal } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { getDistrictById, getProvinceById } from "../lib/turkey-provinces";
import { quoteCouponForOrder, reserveCouponForOrder } from "./coupons";
import { readPaymentSettings } from "./payments";
import { readStoreSettings } from "./settings";
import { getSellerInfo } from "../lib/store-config";
import { isValidTaxNumber } from "../lib/orders";
import { getProductVariantTitle } from "../lib/catalog/variants";
import { quotePromotions } from "../lib/promotions";
import { getShippingQuote } from "../lib/shipping";
import { randomHex } from "./random";
import { adjustInventoryForOrder, changeOrderStatus, publicOrderValidator, toPublicOrder } from "./orders/helpers";

const orderRateLimiter = new RateLimiter(components.rateLimiter, {
  orderByEmail: { kind: "fixed window", rate: 4, period: 60 * 60 * 1000 },
  orderByAccount: { kind: "fixed window", rate: 6, period: 60 * 60 * 1000 },
});

const orderValidator = schema.doc("orders");
const orderItemValidator = orderValidator.fields.items.element;
const orderStatusValidator = orderValidator.fields.status;
const orderPaymentStatusValidator = orderValidator.fields.paymentStatus;

export const getMyOrders = query({
  args: {},
  returns: v.array(publicOrderValidator),
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

    return orders.map(toPublicOrder);
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
      .withIndex("by_payment_status", (q) => q.eq("paymentStatus", "paid"))
      .order("desc")
      .take(200);
    const counts = new Map<string, number>();

    for (const order of orders) {
      if (order.status === "cancelled") continue;
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
      .withIndex("by_payment_status", (q) => q.eq("paymentStatus", "paid").gte("_creationTime", since))
      .order("desc")
      .take(250);
    const latestPurchaseByBuyer = new Map<string, number>();

    for (const order of recentOrders) {
      if (order.status === "cancelled") continue;
      if (!order.items.some((item) => item.productId === productId)) continue;
      const buyer = order.customerEmail.trim().toLowerCase();
      latestPurchaseByBuyer.set(buyer, Math.max(latestPurchaseByBuyer.get(buyer) ?? 0, order._creationTime));
    }

    const expirations = [...latestPurchaseByBuyer.values()].map((_creationTime) => _creationTime + day);
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
    id: v.string(),
    token: v.optional(v.string()),
  },
  returns: v.union(publicOrderValidator, v.null()),
  handler: async (ctx, args) => {
    const orderId = ctx.db.normalizeId("orders", args.id);
    if (!orderId) return null;
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    const userId = await getAuthUserId(ctx);
    if (order.userId) {
      if (!userId || order.userId !== userId) return null;
    } else if (!args.token || order.accessToken !== args.token) {
      return null;
    }

    return toPublicOrder(order);
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
    shippingAddress: v.string(),
    billingType: v.optional(v.union(v.literal("individual"), v.literal("corporate"))),
    companyName: v.optional(v.string()),
    taxOffice: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    legalAcceptance: v.object({
      accepted: v.literal(true),
      distanceSalesAgreementVersion: v.string(),
      preInformationFormVersion: v.string(),
      termsVersion: v.string(),
    }),
    saveAddress: v.optional(
      schema.doc("addresses").pick("title", "city", "district", "provinceId", "districtId", "addressLine1")
        .extend({ isDefault: v.optional(v.boolean()) })
    ),
    paymentMethod: v.union(
      v.literal("cash_on_delivery"),
      v.literal("bank_transfer"),
      v.literal("paytr")
    ),
  },
  returns: v.object({ orderId: v.id("orders"), accessToken: v.string() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const province = getProvinceById(args.provinceId);
    const district = getDistrictById(args.provinceId, args.districtId);
    if (!province || !district) throw new Error("Türkiye il ve ilçe listesinden geçerli bir adres seçin.");
    const customerName = args.customerName.trim();
    const customerEmail = args.customerEmail.trim().toLowerCase();
    if (!customerName || customerName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 120) {
      throw new Error("Geçerli bir ad (en fazla 100 karakter) ve e-posta (en fazla 120 karakter) gereklidir.");
    }
    if (args.customerPhone && args.customerPhone.trim().length > 30) {
      throw new Error("Telefon numarası en fazla 30 karakter olabilir.");
    }
    if (args.shippingAddress.trim().length < 10 || args.shippingAddress.trim().length > 500) {
      throw new Error("Geçerli bir teslimat adresi gereklidir (10-500 karakter).");
    }
    const billingType = args.billingType ?? "individual";
    const companyName = args.companyName?.trim();
    const taxOffice = args.taxOffice?.trim();
    const taxNumber = args.taxNumber?.trim();
    const billingAddress = args.billingAddress?.trim() || args.shippingAddress?.trim();

    if (billingType === "corporate") {
      if (!companyName || companyName.length > 200) {
        throw new Error("Kurumsal fatura için firma unvanı gereklidir (en fazla 200 karakter).");
      }
      if (!taxOffice || taxOffice.length > 100) {
        throw new Error("Kurumsal fatura için vergi dairesi gereklidir (en fazla 100 karakter).");
      }
      if (!taxNumber || !isValidTaxNumber(taxNumber)) {
        throw new Error("Geçerli bir Vergi Kimlik Numarası (10 hane) veya TCKN (11 hane) girin.");
      }
      if (!billingAddress || billingAddress.length > 500) {
        throw new Error("Fatura adresi en fazla 500 karakter olabilir.");
      }
    } else if (billingAddress && billingAddress.length > 500) {
      throw new Error("Fatura adresi en fazla 500 karakter olabilir.");
    }
    const storeSettings = await readStoreSettings(ctx);
    if (!storeSettings.isOpen) {
      throw new Error("Mağaza şu anda sipariş kabul etmiyor.");
    }
    const { distanceSalesAgreement: agreement, preInformationForm: preInformation } =
      getLegalDocuments(getSellerInfo(storeSettings));
    if (!agreement.ready || !preInformation.ready) {
      throw new Error("Satıcı bilgileri tamamlanmadığı için sipariş kabul edilemiyor.");
    }
    if (
      args.legalAcceptance.accepted !== true ||
      args.legalAcceptance.distanceSalesAgreementVersion !== agreement.version ||
      args.legalAcceptance.preInformationFormVersion !== preInformation.version ||
      args.legalAcceptance.termsVersion !== TERMS_VERSION
    ) {
      throw new Error("Yasal belgeler değişti veya onaylanmadı. Sayfayı yenileyip tekrar kontrol edin.");
    }
    const recordedLegalAcceptance = {
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
      termsVersion: args.legalAcceptance.termsVersion,
    };
    const emailKey = args.customerEmail.trim().toLowerCase();
    const emailLimit = await orderRateLimiter.limit(ctx, "orderByEmail", { key: emailKey });
    if (!emailLimit.ok) throw new Error("Bu e-posta adresiyle çok sık sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    if (userId) {
      const accountLimit = await orderRateLimiter.limit(ctx, "orderByAccount", { key: userId });
      if (!accountLimit.ok) throw new Error("Hesabınızdan kısa sürede çok fazla sipariş başlatıldı. Bir süre sonra tekrar deneyin.");
    }
    if (args.items.length === 0 || args.items.length > 100) throw new Error("Sipariş 1 ile 100 ürün içermeli.");
    const items = [];
    const promotionLines: Array<{ productId: string; unitPriceKurus: number; quantity: number; categorySlug?: string }> = [];
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
      promotionLines.push({ productId: product._id, unitPriceKurus: cents, quantity: item.quantity, categorySlug: product.categorySlug });
      const image = await resolveVariantImageUrl(ctx, product, variant!.selectedOptions);
      items.push({
        productId: product._id,
        variantId: variant?.id,
        title: getProductVariantTitle(product.title, variant),
        quantity: item.quantity,
        price: (cents / 100).toFixed(2),
        sku: variant?.sku,
        image: image ?? undefined,
      });
    }
    const coupon = args.couponCode?.trim()
      ? await quoteCouponForOrder(ctx, args.couponCode, totalCents)
      : undefined;
    const couponedCents = coupon?.valid ? coupon.totalKurus : totalCents;
    const activePromotions = await ctx.db.query("promotions").withIndex("by_active", (q) => q.eq("isActive", true)).take(50);
    const promotion = quotePromotions(
      promotionLines,
      activePromotions.map((rule) => ({
        id: rule._id,
        title: rule.title,
        type: rule.type,
        productId: rule.productId,
        categorySlug: rule.categorySlug,
        percentage: rule.percentage,
        buyQuantity: rule.buyQuantity,
        payQuantity: rule.payQuantity,
        minSubtotalKurus: rule.minSubtotalKurus,
      })),
      couponedCents,
      totalCents,
    );
    const payableCents = couponedCents - promotion.discountKurus;
    if (payableCents <= 0) throw new Error("İndirimler sepet toplamını sıfırlıyor; bu ödeme akışında ücretsiz sipariş oluşturulamıyor.");

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
        throw new Error("Kart ile ödeme bu sürümde kullanıma açık değildir. Havale/EFT veya kapıda ödemeyi seçin.");
      }
    }

    const shipping = getShippingQuote({
      subtotal: totalCents / 100,
      freeShippingThreshold: storeSettings.freeShippingThreshold ?? 0,
      shippingFee: storeSettings.shippingFee ?? 0,
      promotionFreeShipping: promotion.freeShipping,
    });
    const shippingFee = shipping.shippingFee;
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
    // Tüm siparişler "Sipariş Alındı" ("received") ve "Ödeme Bekliyor" ("pending") olarak açılır.
    // "paid" yalnızca yönetici ödeme onayıyla yazılır; PayTR demo akışı da gerçek tahsilat yapmaz.
    const accessToken = randomHex(32);
    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      customerEmail,
      accessToken,
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
      ...(promotion.discountKurus > 0 ? {
        promotionDiscountKurus: promotion.discountKurus,
        ...(promotion.title ? { promotionTitle: promotion.title } : {}),
      } : {}),
      ...(promotion.freeShippingTitle ? { freeShippingPromotionTitle: promotion.freeShippingTitle } : {}),
      status: "received",
      paymentStatus: "pending",
      ...(args.paymentMethod ? {
        paymentMethod: args.paymentMethod,
        paymentMethodTitle,
        ...(paymentFee !== undefined ? { paymentFee } : {}),
      } : {}),
      ...(shippingFee > 0 ? { shippingFee } : {}),
      ...(analyticsSessionId ? { analyticsSessionId } : {}),
      shippingAddress: args.shippingAddress,
      billingType,
      ...(billingType === "corporate" ? {
        companyName,
        taxOffice,
        taxNumber,
      } : {}),
      ...(billingAddress ? { billingAddress } : {}),
      ...(recordedLegalAcceptance ? { legalAcceptance: recordedLegalAcceptance } : {}),
    });
    const createdOrder = await ctx.db.get(orderId);
    if (!createdOrder) throw new Error("Sipariş oluşturulamadı.");
    // Stok sipariş anında rezerve edilir; iptal changeOrderStatus üzerinden geri yükler.
    await adjustInventoryForOrder(ctx, createdOrder, -1);
    // Kupon kullanım hakkı da sipariş anında düşülür; iptalde geri iade edilir.
    if (coupon?.valid) await reserveCouponForOrder(ctx, createdOrder);
    await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.markConvertedForOrder, { orderId });

    // Müşteriye sipariş alındı e-postası (havale/EFT veya kapıda ödeme beklenen siparişler dahil)
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event: "order_placed" });
    // Yöneticiye yeni sipariş bildirimi
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event: "admin_order_alert" });

    return { orderId, accessToken };
  },
});

export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("orders"),
    status: v.optional(orderStatusValidator),
    paymentStatus: v.optional(orderPaymentStatusValidator),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await changeOrderStatus(ctx, args.id, {
      status: args.status,
      paymentStatus: args.paymentStatus,
      carrier: args.carrier,
      trackingNumber: args.trackingNumber,
      trackingUrl: args.trackingUrl,
    });
  },
});

// Yalnızca online ön ödeme bekleyen PayTR siparişleri zaman aşımına uğrar.
// Kapıda ödeme teslimde tahsil edilir; havale/EFT ise yönetici onayı bekler.
const PAYTR_UNPAID_ORDER_TTL_MS = 2 * 60 * 60 * 1000;

export const cancelStaleUnpaid = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PAYTR_UNPAID_ORDER_TTL_MS;
    const stale = await ctx.db.query("orders")
      .withIndex("by_status_and_payment_status_and_paymentMethod", (q) =>
        q.eq("status", "received").eq("paymentStatus", "pending").eq("paymentMethod", "paytr").lt("_creationTime", cutoff)
      )
      .take(100);
    for (const order of stale) {
      await changeOrderStatus(ctx, order._id, { status: "cancelled" });
    }
    if (stale.length === 100) {
      await ctx.scheduler.runAfter(0, internal.orders.cancelStaleUnpaid, {});
    }
    return null;
  },
});
