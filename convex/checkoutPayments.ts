import { action, env, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { RateLimiter } from "@convex-dev/rate-limiter";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { hashRiskIdentifier, signedRiskContextValidator, verifyCheckoutRiskContext } from "./paymentRisk";
import { commitOrderInventory, reserveOrderInventory } from "./inventory";
import { commitCouponReservation, reserveCouponForOrder } from "./coupons";
import { getDistrictById, getProvinceById } from "../lib/turkey-provinces";
import { allocateCouponDiscount } from "../lib/commerce/coupon-discount";

const checkoutPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const retrievePath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
const checkoutTtl = 30 * 60 * 1000;
const riskLookbackMs = 24 * 60 * 60 * 1000;
const checkoutRateLimiter = new RateLimiter(components.rateLimiter, {
  paymentByEmail: { kind: "fixed window", rate: 4, period: 60 * 60 * 1000 },
  paymentByAccount: { kind: "fixed window", rate: 6, period: 60 * 60 * 1000 },
  paymentByIp: { kind: "fixed window", rate: 10, period: 60 * 60 * 1000 },
});
const checkoutPaymentValidator = schema.doc("checkoutPayments");
type PaymentProvider = "iyzico" | "paytr";
const approvableRiskSignals = new Set([
  "guest_checkout",
  "new_account",
  "repeat_attempts",
  "previous_payment_failures",
  "previous_provider_rejection",
  "high_order_value",
  "local_risk_hold",
]);

type IyziResponse = Record<string, unknown>;
type PaymentRiskFields = {
  fraudStatus?: -1 | 0 | 1;
  riskReasons: string[];
  paymentId?: string;
};
type BeginPaymentResult = {
  kind: "created" | "existing" | "inProgress";
  paymentId: Id<"checkoutPayments">;
  conversationId: string;
  paymentPageUrl: string | null;
};

async function finalizePaidOrder(
  ctx: MutationCtx,
  order: Doc<"orders">,
  payment: Doc<"checkoutPayments">,
  paymentRiskFields: PaymentRiskFields,
) {
  await ctx.db.patch(payment._id, {
    status: "paid",
    riskDecision: "allow",
    ...paymentRiskFields,
  });
  await commitOrderInventory(ctx, order._id);
  await commitCouponReservation(ctx, order);
  await ctx.db.patch(order._id, { status: "paid", paidAt: order.paidAt ?? Date.now() });
  await ctx.scheduler.runAfter(0, internal.analytics.syncOrderAttribution, { orderId: order._id });
  await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.markConvertedForOrder, { orderId: order._id });
  await ctx.scheduler.runAfter(0, internal.invoices.issueForOrder, { orderId: order._id });
  await ctx.scheduler.runAfter(0, internal.shipping.createForPaidOrderScheduled, { orderId: order._id });
  await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: order._id, event: "payment_confirmation" });
}

function canApproveRiskHeldPayment(payment: Doc<"checkoutPayments"> | null) {
  const riskReasons = payment?.riskReasons ?? [];
  return Boolean(payment && payment.status === "review" && payment.riskDecision === "review" &&
    riskReasons.includes("local_risk_hold") && riskReasons.every((reason) => approvableRiskSignals.has(reason)) &&
    (payment.provider === "iyzico" ? payment.fraudStatus === 1 && Boolean(payment.paymentId) : Boolean(payment.merchantOid)));
}

function providerBase() {
  const base = env.IYZICO_BASE_URL ?? "https://api.iyzipay.com";
  if (base !== "https://api.iyzipay.com" && base !== "https://sandbox-api.iyzipay.com") {
    throw new Error("iyzico adresi geçersiz.");
  }
  return base;
}

function isPaymentConfigured() {
  return configuredPaymentProvider() !== null;
}

function configuredPaymentProvider(): PaymentProvider | null {
  const provider = env.PAYMENT_PROVIDER ?? "iyzico";
  if (!validHttpsUrl(env.CONVEX_SITE_URL) || !validHttpsUrl(env.PAYMENT_RETURN_URL)) return null;
  if (provider === "paytr") {
    return env.PAYTR_MERCHANT_ID && env.PAYTR_MERCHANT_KEY && env.PAYTR_MERCHANT_SALT &&
      (env.PAYTR_TEST_MODE === undefined || env.PAYTR_TEST_MODE === "0" || env.PAYTR_TEST_MODE === "1")
      ? "paytr"
      : null;
  }
  if (provider !== "iyzico" || !env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY) return null;
  try {
    providerBase();
    return "iyzico";
  } catch {
    return null;
  }
}

function paymentProviderForDisplay(): PaymentProvider {
  return env.PAYMENT_PROVIDER === "paytr" ? "paytr" : "iyzico";
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function iyzicoRequest(path: string, body: Record<string, unknown>): Promise<IyziResponse> {
  const apiKey = env.IYZICO_API_KEY;
  const secretKey = env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Ödeme altyapısı yapılandırılmamış.");

  const randomKey = `${Date.now()}${crypto.randomUUID().replaceAll("-", "")}`;
  const bodyText = JSON.stringify(body);
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = toHex(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(`${randomKey}${path}${bodyText}`),
  )));
  const authorizationPayload = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const response = await fetch(`${providerBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `IYZWSv2 ${btoa(authorizationPayload)}`,
      "Content-Type": "application/json",
      "x-iyzi-rnd": randomKey,
    },
    body: bodyText,
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object") {
    throw new Error("Ödeme sağlayıcısına ulaşılamadı.");
  }
  return result as IyziResponse;
}

async function hmacBase64(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return btoa(String.fromCharCode(...signature));
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
}

function equalSignature(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function validHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function moneyToCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export const getAvailability = query({
  args: {},
  returns: v.object({ ready: v.boolean(), provider: v.union(v.literal("iyzico"), v.literal("paytr")) }),
  handler: async () => ({ ready: isPaymentConfigured(), provider: paymentProviderForDisplay() }),
});

export const listRiskForOrders = query({
  args: { adminSecret: v.string(), orderIds: v.array(v.id("orders")) },
  returns: v.array(v.object({
    orderId: v.id("orders"),
    status: v.union(v.literal("initializing"), v.literal("pending"), v.literal("review"), v.literal("paid"), v.literal("failed")),
    provider: v.union(v.literal("iyzico"), v.literal("paytr")),
    riskScore: v.union(v.number(), v.null()),
    riskDecision: v.union(v.literal("allow"), v.literal("review"), v.literal("blocked"), v.null()),
    riskReasons: v.array(v.string()),
    fraudStatus: v.union(v.literal(-1), v.literal(0), v.literal(1), v.null()),
    reviewApprovable: v.boolean(),
  })),
  handler: async (ctx, { adminSecret, orderIds }) => {
    assertAdminApiSecret(adminSecret);
    if (orderIds.length > 100) throw new Error("Bir istekte en fazla 100 sipariş için risk bilgisi alınabilir.");
    const payments = await Promise.all(orderIds.map((orderId) => ctx.db.query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first()));
    return payments.flatMap((payment) => payment ? [{
      orderId: payment.orderId,
      status: payment.status,
      provider: payment.provider,
      riskScore: payment.riskScore ?? null,
      riskDecision: payment.riskDecision ?? null,
      riskReasons: payment.riskReasons ?? [],
      fraudStatus: payment.fraudStatus ?? null,
      reviewApprovable: canApproveRiskHeldPayment(payment),
    }] : []);
  },
});

export const getPaymentByToken = internalQuery({
  args: { token: v.string() },
  returns: v.union(checkoutPaymentValidator, v.null()),
  handler: async (ctx, { token }) => await ctx.db
    .query("checkoutPayments")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first(),
});

export const getPaymentByMerchantOid = internalQuery({
  args: { merchantOid: v.string() },
  returns: v.union(checkoutPaymentValidator, v.null()),
  handler: async (ctx, { merchantOid }) => await ctx.db
    .query("checkoutPayments")
    .withIndex("by_merchant_oid", (q) => q.eq("merchantOid", merchantOid))
    .first(),
});

export const beginPayment = internalMutation({
  args: {
    orderId: v.id("orders"),
    provider: v.union(v.literal("iyzico"), v.literal("paytr")),
    conversationId: v.string(),
    emailHash: v.string(),
    emailLimitKey: v.string(),
    ipHash: v.optional(v.string()),
  },
  returns: v.object({
    kind: v.union(v.literal("created"), v.literal("existing"), v.literal("inProgress")),
    paymentId: v.id("checkoutPayments"),
    conversationId: v.string(),
    paymentPageUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { orderId, provider, conversationId, emailHash, emailLimitKey, ipHash }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "pending") throw new Error("Ödeme bekleyen sipariş bulunamadı.");

    const existing = await ctx.db
      .query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    const now = Date.now();
    if (!order.inventoryReserved && order.reservationExpiresAt != null && order.reservationExpiresAt <= now) {
      throw new Error("Siparişin ödeme süresi doldu. Sepetinizi yeniden oluşturun.");
    }
    if (existing && existing.status === "pending" && existing.expiresAt > now && existing.paymentPageUrl) {
      return {
        kind: "existing" as const,
        paymentId: existing._id,
        conversationId: existing.conversationId,
        paymentPageUrl: existing.paymentPageUrl,
      };
    }
    if (existing?.status === "pending" && existing.expiresAt <= now) {
      await ctx.db.patch(existing._id, { status: "failed" });
      await ctx.runMutation(internal.orders.cancelPendingOrder, { id: orderId });
      throw new Error("Ödeme süresi doldu. Lütfen sepetinizi yeniden oluşturun.");
    }
    if (existing && existing.expiresAt > now && existing.status === "initializing") {
      return {
        kind: "inProgress" as const,
        paymentId: existing._id,
        conversationId: existing.conversationId,
        paymentPageUrl: null,
      };
    }
    if (existing?.status === "review") {
      throw new Error("Ödemeniz incelemede. Siparişiniz sonuçlanınca e-posta ile bilgilendirileceksiniz.");
    }
    if (existing && existing.status === "initializing" && existing.expiresAt <= now) {
      await ctx.db.patch(existing._id, { status: "failed" });
    }

    const emailLimit = await checkoutRateLimiter.limit(ctx, "paymentByEmail", { key: emailLimitKey });
    if (!emailLimit.ok) throw new Error("Bu e-posta adresiyle çok sık ödeme denemesi yapıldı. Bir süre sonra tekrar deneyin.");
    if (ipHash) {
      const ipLimit = await checkoutRateLimiter.limit(ctx, "paymentByIp", { key: ipHash });
      if (!ipLimit.ok) throw new Error("Bu bağlantıdan kısa sürede çok fazla ödeme denemesi yapıldı. Bir süre sonra tekrar deneyin.");
    }
    if (order.userId) {
      const accountHash = await hashRiskIdentifier(`account:${order.userId}`, env.CHECKOUT_RISK_CONTEXT_SECRET);
      const accountLimit = await checkoutRateLimiter.limit(ctx, "paymentByAccount", { key: accountHash });
      if (!accountLimit.ok) throw new Error("Hesabınızdan kısa sürede çok fazla ödeme denemesi yapıldı. Bir süre sonra tekrar deneyin.");
    }

    const recentPayments = await ctx.db.query("checkoutPayments")
      .withIndex("by_email_hash", (q) => q.eq("emailHash", emailHash).gte("_creationTime", now - riskLookbackMs))
      .order("desc")
      .take(20);
    const account = order.userId ? await ctx.db.get(order.userId) : null;
    const riskReasons: string[] = [];
    let riskScore = 0;
    if (!order.userId) {
      riskReasons.push("guest_checkout");
      riskScore += 8;
    } else if (account && now - account._creationTime < riskLookbackMs) {
      riskReasons.push("new_account");
      riskScore += 20;
    }
    if (recentPayments.length >= 2) {
      riskReasons.push("repeat_attempts");
      riskScore += recentPayments.length >= 4 ? 25 : 10;
    }
    const priorProviderRejections = recentPayments.filter((payment) => payment.fraudStatus === -1).length;
    if (priorProviderRejections > 0) {
      riskReasons.push("previous_provider_rejection");
      riskScore += Math.min(35, priorProviderRejections * 25);
    } else if (recentPayments.filter((payment) => payment.status === "failed").length >= 2) {
      riskReasons.push("previous_payment_failures");
      riskScore += 15;
    }
    const orderCents = moneyToCents(order.total) ?? 0;
    if (orderCents >= 5_000_000) {
      riskReasons.push("high_order_value");
      riskScore += 25;
    } else if (orderCents >= 2_500_000) {
      riskReasons.push("high_order_value");
      riskScore += 15;
    }
    riskScore = Math.min(100, riskScore);
    const riskDecision = riskScore >= 45 ? "review" as const : "allow" as const;

    await reserveCouponForOrder(ctx, order);
    await reserveOrderInventory(ctx, order, now + checkoutTtl);
    const paymentId = await ctx.db.insert("checkoutPayments", {
      orderId,
      provider,
      status: "initializing",
      conversationId,
      emailHash,
      riskScore,
      riskDecision,
      riskReasons,
      expiresAt: now + checkoutTtl,
    });
    await ctx.scheduler.runAfter(riskLookbackMs, internal.checkoutPayments.clearRiskHash, { paymentId });
    await ctx.scheduler.runAfter(checkoutTtl, internal.checkoutPayments.expirePayment, {
      paymentId,
      expiresAt: now + checkoutTtl,
    });
    return { kind: "created" as const, paymentId, conversationId, paymentPageUrl: null };
  },
});

export const expirePayment = internalMutation({
  args: { paymentId: v.id("checkoutPayments"), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { paymentId, expiresAt }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.expiresAt !== expiresAt || payment.expiresAt > Date.now() ||
      (payment.status !== "initializing" && payment.status !== "pending")) return null;
    await ctx.db.patch(paymentId, { status: "failed" });
    await ctx.runMutation(internal.orders.cancelPendingOrder, { id: payment.orderId });
    return null;
  },
});

export const clearRiskHash = internalMutation({
  args: { paymentId: v.id("checkoutPayments") },
  returns: v.null(),
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment?.emailHash || Date.now() - payment._creationTime < riskLookbackMs) return null;
    await ctx.db.patch(paymentId, { emailHash: undefined });
    return null;
  },
});

export const saveProviderCheckout = internalMutation({
  args: {
    paymentId: v.id("checkoutPayments"),
    token: v.string(),
    paymentPageUrl: v.string(),
    merchantOid: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.status !== "initializing") throw new Error("Ödeme oturumu artık geçerli değil.");
    await ctx.db.patch(args.paymentId, {
      status: "pending",
      token: args.token,
      paymentPageUrl: args.paymentPageUrl,
      ...(args.merchantOid ? { merchantOid: args.merchantOid } : {}),
    });
    return null;
  },
});

export const failCheckout = internalMutation({
  args: { paymentId: v.id("checkoutPayments") },
  returns: v.null(),
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (payment && (payment.status === "initializing" || payment.status === "pending")) {
      await ctx.db.patch(paymentId, { status: "failed" });
      await ctx.runMutation(internal.orders.cancelPendingOrder, { id: payment.orderId });
    }
    return null;
  },
});

export const createCheckout = action({
  args: {
    orderId: v.id("orders"),
    customerEmail: v.string(),
    customerName: v.string(),
    customerPhone: v.string(),
    shippingAddress: v.string(),
    city: v.string(),
    provinceId: v.string(),
    districtId: v.string(),
    identityNumber: v.string(),
    riskContext: v.optional(signedRiskContextValidator),
  },
  returns: v.object({ paymentPageUrl: v.string() }),
  handler: async (ctx, args): Promise<{ paymentPageUrl: string }> => {
    const provider = configuredPaymentProvider();
    if (!provider || !validHttpsUrl(env.PAYMENT_RETURN_URL)) {
      throw new Error("Ödeme altyapısı henüz yapılandırılmamış.");
    }
    const trustedIp = await verifyCheckoutRiskContext(args.riskContext, env.CHECKOUT_RISK_CONTEXT_SECRET);
    if (args.riskContext && !trustedIp) {
      throw new Error("Güvenlik doğrulaması geçersiz veya süresi doldu. Sayfayı yenileyip tekrar deneyin.");
    }
    if (env.CHECKOUT_RISK_CONTEXT_REQUIRED === "true" && !trustedIp) {
      throw new Error("Güvenlik doğrulaması eksik. Sayfayı yenileyip tekrar deneyin.");
    }
    if (provider === "paytr" && !trustedIp) {
      throw new Error("PayTR ödemesi için güvenli IP doğrulaması gerekli.");
    }
    if (!/^\d{11}$/.test(args.identityNumber)) throw new Error("T.C. Kimlik No 11 haneli olmalıdır.");
    if (args.customerName.trim().split(/\s+/).length < 2) throw new Error("Lütfen ad ve soyadınızı birlikte yazın.");
    if (args.city.trim().length < 2 || args.customerPhone.trim().length < 10) throw new Error("Telefon ve il bilgileri kontrol edilmelidir.");
    if (provider === "paytr" && /[^\x00-\x7F]/.test(args.customerEmail)) {
      throw new Error("PayTR için e-posta adresinde Türkçe karakter kullanılamaz.");
    }

    const order: Doc<"orders"> | null = await ctx.runQuery(internal.orders.getOrderForPayment, {
      id: args.orderId,
      customerEmail: args.customerEmail,
    });
    if (!order || order.status !== "pending") throw new Error("Sipariş bulunamadı veya ödeme beklemiyor.");
    const province = getProvinceById(args.provinceId);
    const district = getDistrictById(args.provinceId, args.districtId);
    if (!province || !district || order.provinceId !== province.id || order.districtId !== district.id ||
      order.city !== province.name || order.district !== district.name) {
      throw new Error("Teslimat ili veya ilçesi değişti. Adresinizi yeniden seçin.");
    }
    if (
      order.customerEmail.trim().toLowerCase() !== args.customerEmail.trim().toLowerCase() ||
      order.customerName.trim() !== args.customerName.trim() ||
      order.shippingAddress !== args.shippingAddress ||
      (order.customerPhone && order.customerPhone !== args.customerPhone.trim())
    ) {
      throw new Error("Sipariş bilgileri değişti. Bilgilerinizi kontrol edip tekrar deneyin.");
    }

    const reservation: BeginPaymentResult = await ctx.runMutation(internal.checkoutPayments.beginPayment, {
      orderId: args.orderId,
      provider,
      conversationId: crypto.randomUUID(),
      emailHash: await hashRiskIdentifier(`email:${order.customerEmail.trim().toLowerCase()}`, env.CHECKOUT_RISK_CONTEXT_SECRET),
      emailLimitKey: trustedIp
        ? await hashRiskIdentifier(`email-ip:${order.customerEmail.trim().toLowerCase()}:${trustedIp}`, env.CHECKOUT_RISK_CONTEXT_SECRET)
        : await hashRiskIdentifier(`email:${order.customerEmail.trim().toLowerCase()}`, env.CHECKOUT_RISK_CONTEXT_SECRET),
      ...(trustedIp ? { ipHash: await hashRiskIdentifier(`ip:${trustedIp}`, env.CHECKOUT_RISK_CONTEXT_SECRET) } : {}),
    });
    if (reservation.kind === "existing" && reservation.paymentPageUrl) {
      return { paymentPageUrl: reservation.paymentPageUrl };
    }
    if (reservation.kind === "inProgress") throw new Error("Ödeme sayfası hazırlanıyor. Biraz sonra tekrar deneyin.");

    const names = args.customerName.trim().split(/\s+/);
    const buyerId = order.userId
      ? String(order.userId)
      : `guest-${toHex(new Uint8Array(await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(order.customerEmail.trim().toLowerCase()),
      )))}`;
    const buyer = {
      id: buyerId,
      name: names[0],
      surname: names.slice(1).join(" "),
      identityNumber: args.identityNumber,
      email: order.customerEmail,
      gsmNumber: args.customerPhone.trim(),
      ...(trustedIp ? { ip: trustedIp } : {}),
      registrationAddress: args.shippingAddress,
      city: province.name,
      country: "Turkey",
    };
    const address = {
      address: args.shippingAddress,
      contactName: args.customerName.trim(),
      city: province.name,
      country: "Turkey",
    };
    const discountedLines = allocateCouponDiscount(order.items, order.couponDiscountKurus ?? 0);
    const shippingCostKurus = order.shippingCostKurus ?? 0;
    if (!Number.isSafeInteger(shippingCostKurus) || shippingCostKurus < 0) {
      throw new Error("Sipariş kargo tutarı geçersiz.");
    }
    const basketItems = order.items.map((item, index) => {
      const { payableKurus } = discountedLines[index];
      return {
        id: `${item.productId}-${index + 1}`,
        price: (payableKurus / 100).toFixed(2),
        name: item.title.slice(0, 100),
        category1: "Mağaza Ürünü",
        itemType: "PHYSICAL",
      };
    });
    if (shippingCostKurus > 0) {
      basketItems.push({
        id: "shipping",
        price: (shippingCostKurus / 100).toFixed(2),
        name: "Kargo",
        category1: "Teslimat",
        itemType: "PHYSICAL",
      });
    }
    const providerBasketTotal = basketItems.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0);
    const orderTotalKurus = moneyToCents(order.total);
    if (orderTotalKurus === null || providerBasketTotal !== orderTotalKurus) {
      throw new Error("Ödeme sepeti ile sipariş toplamı uyuşmuyor.");
    }
    const payload = {
      locale: "tr",
      conversationId: reservation.conversationId,
      price: order.total,
      paidPrice: order.total,
      currency: "TRY",
      basketId: String(order._id),
      paymentGroup: "PRODUCT",
      callbackUrl: `${env.CONVEX_SITE_URL}/iyzico/checkout-callback`,
      enabledInstallments: [1],
      buyer,
      shippingAddress: address,
      billingAddress: address,
      basketItems,
    };

    try {
      if (provider === "paytr") {
        const merchantId = env.PAYTR_MERCHANT_ID;
        const merchantKey = env.PAYTR_MERCHANT_KEY;
        const merchantSalt = env.PAYTR_MERCHANT_SALT;
        if (!merchantId || !merchantKey || !merchantSalt || !trustedIp) {
          throw new Error("PayTR yapılandırması tamamlanmamış.");
        }
        const amountKurus = moneyToCents(order.total);
        if (amountKurus === null || amountKurus <= 0) throw new Error("Ödeme tutarı geçersiz.");
        const merchantOid = `C${toHex(new TextEncoder().encode(String(order._id)))}`;
        const paytrBasket: Array<[string, string, number]> = [];
        for (const [index, item] of order.items.entries()) {
          const payableKurus = discountedLines[index].payableKurus;
          if (!Number.isSafeInteger(payableKurus) || payableKurus < 0 ||
            !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
            throw new Error("Ödeme sepetindeki ürün tutarı geçersiz.");
          }
          const baseUnitKurus = Math.floor(payableKurus / item.quantity);
          const remainderQuantity = payableKurus % item.quantity;
          const baseQuantity = item.quantity - remainderQuantity;
          if (baseUnitKurus > 0 && baseQuantity > 0) {
            paytrBasket.push([item.title.slice(0, 100), (baseUnitKurus / 100).toFixed(2), baseQuantity]);
          }
          if (remainderQuantity > 0) {
            paytrBasket.push([item.title.slice(0, 100), ((baseUnitKurus + 1) / 100).toFixed(2), remainderQuantity]);
          }
        }
        if (shippingCostKurus > 0) {
          paytrBasket.push(["Kargo", (shippingCostKurus / 100).toFixed(2), 1]);
        }
        const paytrBasketTotal = paytrBasket.reduce((sum, [, unitPrice, quantity]) =>
          sum + Math.round(Number(unitPrice) * 100) * quantity, 0);
        if (paytrBasketTotal !== orderTotalKurus) throw new Error("PayTR sepeti ile sipariş toplamı uyuşmuyor.");
        const userBasket = base64Utf8(JSON.stringify(paytrBasket));
        const noInstallment = "1";
        const maxInstallment = "0";
        const currency = "TL";
        const testMode = env.PAYTR_TEST_MODE ?? "1";
        const hashString = `${merchantId}${trustedIp}${merchantOid}${order.customerEmail}${amountKurus}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}${merchantSalt}`;
        const paytrToken = await hmacBase64(merchantKey, hashString);
        const returnBase = env.PAYMENT_RETURN_URL;
        if (!returnBase) throw new Error("Ödeme dönüş adresi yapılandırılmamış.");
        const okUrl = new URL("/checkout/result?status=pending&provider=paytr", returnBase).toString();
        const failUrl = okUrl;
        const form = new URLSearchParams({
          merchant_id: merchantId,
          user_ip: trustedIp,
          merchant_oid: merchantOid,
          email: order.customerEmail,
          payment_amount: String(amountKurus),
          paytr_token: paytrToken,
          user_basket: userBasket,
          no_installment: noInstallment,
          max_installment: maxInstallment,
          currency,
          user_name: args.customerName.trim().slice(0, 60),
          user_address: args.shippingAddress.slice(0, 400),
          user_phone: args.customerPhone.trim().slice(0, 20),
          merchant_ok_url: okUrl,
          merchant_fail_url: failUrl,
          test_mode: testMode,
          debug_on: "0",
          timeout_limit: "30",
          lang: "tr",
        });
        const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
          signal: AbortSignal.timeout(15_000),
        });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok || !result || typeof result !== "object" ||
          !("status" in result) || result.status !== "success" ||
          !("token" in result) || typeof result.token !== "string" || !/^[A-Za-z0-9_-]{24,128}$/.test(result.token)) {
          throw new Error("PayTR ödeme formu oluşturulamadı.");
        }
        const paymentPageUrl = new URL("/checkout/paytr", returnBase);
        paymentPageUrl.searchParams.set("token", result.token);
        await ctx.runMutation(internal.checkoutPayments.saveProviderCheckout, {
          paymentId: reservation.paymentId,
          token: result.token,
          merchantOid,
          paymentPageUrl: paymentPageUrl.toString(),
        });
        return { paymentPageUrl: paymentPageUrl.toString() };
      }

      const result = await iyzicoRequest(checkoutPath, payload);
      const token = result.token;
      const pageUrl = result.paymentPageUrl;
      if (result.status !== "success" || typeof token !== "string" || typeof pageUrl !== "string") {
        throw new Error("Ödeme sağlayıcısı ödeme sayfası oluşturamadı.");
      }
      const parsedUrl = new URL(pageUrl);
      const allowedHost = new URL(providerBase()).hostname;
      if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== allowedHost) {
        throw new Error("Ödeme sayfası adresi doğrulanamadı.");
      }
      await ctx.runMutation(internal.checkoutPayments.saveProviderCheckout, {
        paymentId: reservation.paymentId,
        token,
        paymentPageUrl: parsedUrl.toString(),
      });
      return { paymentPageUrl: parsedUrl.toString() };
    } catch (error) {
      await ctx.runMutation(internal.checkoutPayments.failCheckout, { paymentId: reservation.paymentId });
      throw error instanceof Error && error.message === "Ödeme sayfası adresi doğrulanamadı."
        ? error
        : new Error("Ödeme başlatılamadı. Sipariş tutarınız tahsil edilmedi; tekrar deneyin.");
    }
  },
});

export const completePayment = internalMutation({
  args: {
    paymentId: v.id("checkoutPayments"),
    result: v.union(v.literal("paid"), v.literal("review"), v.literal("failed")),
    providerPaymentId: v.optional(v.string()),
    fraudStatus: v.optional(v.union(v.literal(-1), v.literal(0), v.literal(1))),
    riskReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { paymentId, result, providerPaymentId, fraudStatus, riskReason }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.status === "paid" || (payment.status === "failed" && result !== "paid")) return null;
    const order = await ctx.db.get(payment.orderId);
    if (!order) {
      await ctx.db.patch(paymentId, { status: "failed", paymentId: providerPaymentId });
      return null;
    }

    const riskReasons = [...new Set([...(payment.riskReasons ?? []), ...(riskReason ? [riskReason] : [])])];
    const paymentRiskFields = {
      ...(fraudStatus !== undefined ? { fraudStatus } : {}),
      riskReasons,
      ...(providerPaymentId ? { paymentId: providerPaymentId } : {}),
    };

    if (result === "paid" && payment.riskDecision === "review") {
      await ctx.db.patch(paymentId, {
        status: "review",
        riskDecision: "review",
        ...paymentRiskFields,
        riskReasons: [...new Set([...riskReasons, "local_risk_hold"])],
      });
    } else if (result === "paid" && order.status === "pending") {
      await finalizePaidOrder(ctx, order, payment, paymentRiskFields);
    } else if (result === "paid") {
      await ctx.db.patch(paymentId, { status: "review", riskDecision: "review", ...paymentRiskFields });
    } else if (result === "review") {
      await ctx.db.patch(paymentId, { status: "review", riskDecision: "review", ...paymentRiskFields });
    } else {
      await ctx.db.patch(paymentId, {
        status: "failed",
        ...(fraudStatus === -1 ? { riskDecision: "blocked" as const } : {}),
        ...paymentRiskFields,
      });
      await ctx.runMutation(internal.orders.cancelPendingOrder, { id: order._id });
    }
    return null;
  },
});

export const approveRiskHeldPayment = mutation({
  args: { adminSecret: v.string(), orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { adminSecret, orderId }) => {
    assertAdminApiSecret(adminSecret);
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "pending") throw new Error("İncelemedeki sipariş bulunamadı.");
    const payment = await ctx.db.query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    const riskReasons = payment?.riskReasons ?? [];
    if (!payment || !canApproveRiskHeldPayment(payment)) {
      throw new Error("Bu ödeme yalnızca risk puanı nedeniyle beklemiyor veya sağlayıcı onayı doğrulanamıyor.");
    }

    await finalizePaidOrder(ctx, order, payment, {
      ...(payment.fraudStatus !== undefined ? { fraudStatus: payment.fraudStatus } : {}),
      riskReasons: [...new Set([...riskReasons, "manual_review_approved"])],
      ...(payment.paymentId ? { paymentId: payment.paymentId } : {}),
    });
    return null;
  },
});

export const processCallback = internalAction({
  args: { token: v.string() },
  returns: v.union(v.literal("success"), v.literal("review"), v.literal("failed"), v.literal("pending")),
  handler: async (ctx, { token }): Promise<"success" | "review" | "failed" | "pending"> => {
    const payment: Doc<"checkoutPayments"> | null = await ctx.runQuery(internal.checkoutPayments.getPaymentByToken, { token });
    if (!payment) return "failed" as const;
    if (payment.provider !== "iyzico") return "failed" as const;
    if (payment.status === "paid") return "success" as const;
    if (payment.status === "failed") return "failed" as const;
    const order: Doc<"orders"> | null = await ctx.runQuery(internal.orders.getOrderForPaymentInternal, { id: payment.orderId });
    if (!order) return "failed" as const;

    let result: "paid" | "review" | "failed" = "failed";
    let providerPaymentId: string | undefined;
    let fraudStatus: -1 | 0 | 1 | undefined;
    let riskReason: string | undefined;
    try {
      const response = await iyzicoRequest(retrievePath, { locale: "tr", conversationId: payment.conversationId, token });
      const expectedAmount = moneyToCents(order.total);
      const actualPrice = moneyToCents(response.price);
      const actualPaidPrice = moneyToCents(response.paidPrice);
      const basketMatches = response.basketId === String(order._id);
      const amountMatches = expectedAmount !== null && actualPrice === expectedAmount && actualPaidPrice === expectedAmount;
      if (typeof response.paymentId === "string") providerPaymentId = response.paymentId;
      if (response.fraudStatus === -1 || response.fraudStatus === 0 || response.fraudStatus === 1) {
        fraudStatus = response.fraudStatus;
      }
      if (!basketMatches || !amountMatches) {
        result = "review";
        riskReason = "basket_or_amount_mismatch";
      } else if (fraudStatus === -1) {
        result = "failed";
        riskReason = "provider_rejected";
      } else if (response.status === "success" && response.paymentStatus === "SUCCESS" && fraudStatus === 1) {
        result = payment.riskDecision === "review" ? "review" : "paid";
        if (payment.riskDecision === "review") riskReason = "local_risk_hold";
      } else if (response.status === "success" && response.paymentStatus === "SUCCESS" && fraudStatus === 0) {
        result = "review";
        riskReason = "provider_fraud_review";
      } else if (response.status === "success" && response.paymentStatus === "SUCCESS") {
        result = "review";
        riskReason = "provider_risk_status_unknown";
      } else {
        result = "failed";
        riskReason = "provider_payment_failed";
      }
    } catch {
      result = "review";
      riskReason = "provider_verification_error";
    }

    await ctx.runMutation(internal.checkoutPayments.completePayment, {
      paymentId: payment._id,
      result,
      ...(fraudStatus !== undefined ? { fraudStatus } : {}),
      ...(riskReason ? { riskReason } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
    });
    return result === "paid" ? "success" as const : result;
  },
});

export const processPaytrCallback = internalAction({
  args: {
    merchantOid: v.string(),
    status: v.string(),
    totalAmount: v.string(),
    hash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { merchantOid, status, totalAmount, hash }) => {
    const merchantKey = env.PAYTR_MERCHANT_KEY;
    const merchantSalt = env.PAYTR_MERCHANT_SALT;
    if (!merchantKey || !merchantSalt) throw new Error("PayTR callback anahtarları yapılandırılmamış.");
    const expectedHash = await hmacBase64(merchantKey, `${merchantOid}${merchantSalt}${status}${totalAmount}`);
    if (!equalSignature(hash, expectedHash)) throw new Error("PayTR callback imzası geçersiz.");

    const payment: Doc<"checkoutPayments"> | null = await ctx.runQuery(
      internal.checkoutPayments.getPaymentByMerchantOid,
      { merchantOid },
    );
    if (!payment || payment.provider !== "paytr") return false;
    if (payment.status === "paid" || payment.status === "failed") return true;
    const order: Doc<"orders"> | null = await ctx.runQuery(internal.orders.getOrderForPaymentInternal, { id: payment.orderId });
    if (!order) return false;

    const expectedAmount = moneyToCents(order.total);
    const callbackAmount = /^\d+$/.test(totalAmount) ? Number(totalAmount) : null;
    const amountMatches = expectedAmount !== null && callbackAmount === expectedAmount;
    const result = status === "success"
      ? amountMatches ? "paid" as const : "review" as const
      : "failed" as const;
    await ctx.runMutation(internal.checkoutPayments.completePayment, {
      paymentId: payment._id,
      result,
      ...(status === "success" && !amountMatches ? { riskReason: "basket_or_amount_mismatch" } : {}),
    });
    return true;
  },
});

