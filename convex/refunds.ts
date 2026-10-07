import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { action, env, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { allocateCouponDiscount, refundAmountForQuantity } from "../lib/commerce/coupon-discount";

const refundValidator = schema.doc("refunds");
const refundItemsValidator = v.array(v.object({ itemIndex: v.number(), quantity: v.number() }));
const refundStatusValidator = v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed"), v.literal("review"));

type BeginRefundResult = {
  kind: "created" | "existing";
  refundId: Id<"refunds">;
  orderId: Id<"orders">;
  paymentId: Id<"checkoutPayments">;
  provider: "iyzico" | "paytr";
  providerPaymentId?: string;
  merchantOid?: string;
  idempotencyKey: string;
  amountKurus: number;
  status: "pending" | "succeeded" | "failed" | "review";
};

export const listForOrderAdmin = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.array(refundValidator),
  handler: async (ctx, { orderId }) => await ctx.db.query("refunds")
    .withIndex("by_order_and_created_at", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(100),
});

export const beginRefund = internalMutation({
  args: {
    orderId: v.id("orders"),
    items: refundItemsValidator,
    idempotencyKey: v.string(),
  },
  returns: v.object({
    kind: v.union(v.literal("created"), v.literal("existing")),
    refundId: v.id("refunds"),
    orderId: v.id("orders"),
    paymentId: v.id("checkoutPayments"),
    provider: v.union(v.literal("iyzico"), v.literal("paytr")),
    providerPaymentId: v.optional(v.string()),
    merchantOid: v.optional(v.string()),
    idempotencyKey: v.string(),
    amountKurus: v.number(),
    status: refundStatusValidator,
  }),
  handler: async (ctx, { orderId, items, idempotencyKey }): Promise<BeginRefundResult> => {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new Error("İade istek kimliği geçersiz.");
    const existingKey = await ctx.db.query("refunds")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existingKey) {
      if (existingKey.orderId !== orderId) throw new Error("İade istek kimliği başka bir siparişte kullanılmış.");
      const payment = await ctx.db.get(existingKey.paymentId);
      if (!payment) throw new Error("Ödeme kaydı bulunamadı.");
      return {
        kind: "existing",
        refundId: existingKey._id,
        orderId,
        paymentId: existingKey.paymentId,
        provider: existingKey.provider,
        ...(payment.paymentId ? { providerPaymentId: payment.paymentId } : {}),
        ...(payment.merchantOid ? { merchantOid: payment.merchantOid } : {}),
        idempotencyKey,
        amountKurus: existingKey.amountKurus,
        status: existingKey.status,
      };
    }

    const order = await ctx.db.get(orderId);
    if (!order || (order.status !== "paid" && order.status !== "shipped" && order.status !== "delivered")) {
      throw new Error("Yalnızca ödemesi alınmış siparişlere iade yapılabilir.");
    }
    if (items.length === 0 || items.length > order.items.length) throw new Error("İade kalemleri geçersiz.");
    const payment = await ctx.db.query("checkoutPayments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    if (!payment || payment.status !== "paid") throw new Error("Onaylı ödeme kaydı bulunamadı.");
    if (payment.provider === "iyzico" && !payment.paymentId) throw new Error("iyzico ödeme kimliği bulunamadı.");
    if (payment.provider === "paytr" && !payment.merchantOid) throw new Error("PayTR sipariş referansı bulunamadı.");

    const priorRefunds = await ctx.db.query("refunds")
      .withIndex("by_order_and_created_at", (q) => q.eq("orderId", orderId))
      .take(101);
    if (priorRefunds.length > 100) throw new Error("Bu sipariş için iade işlem sınırına ulaşıldı.");
    const existingItems = new Map((order.refundedItems ?? []).map((item) => [item.itemIndex, item]));
    const discountedLines = allocateCouponDiscount(order.items, order.couponDiscountKurus ?? 0);
    const requestedIndexes = new Set<number>();
    const refundItems: Array<{ itemIndex: number; quantity: number; amountKurus: number }> = [];
    let amountKurus = 0;

    for (const requested of items) {
      if (!Number.isSafeInteger(requested.itemIndex) || requested.itemIndex < 0 ||
        requested.itemIndex >= order.items.length || requestedIndexes.has(requested.itemIndex)) {
        throw new Error("İade kalemleri geçersiz veya mükerrer.");
      }
      requestedIndexes.add(requested.itemIndex);
      const line = order.items[requested.itemIndex];
      if (!Number.isSafeInteger(requested.quantity) || requested.quantity < 1) throw new Error("İade adedi en az 1 olmalı.");
      const previous = existingItems.get(requested.itemIndex);
      const previousQuantity = previous?.quantity ?? 0;
      if (previousQuantity + requested.quantity > line.quantity) throw new Error("İade adedi sipariş kalemindeki kalan miktarı aşıyor.");
      const linePayable = discountedLines[requested.itemIndex].payableKurus;
      const itemAmountKurus = refundAmountForQuantity(linePayable, line.quantity, previousQuantity, requested.quantity);
      if (itemAmountKurus <= 0) throw new Error("Seçilen ürün miktarı için iade edilebilir tutar bulunmuyor.");
      amountKurus += itemAmountKurus;
      refundItems.push({ itemIndex: requested.itemIndex, quantity: requested.quantity, amountKurus: itemAmountKurus });
    }

    const orderTotalKurus = Math.round(Number(order.total) * 100);
    if (!Number.isSafeInteger(amountKurus) || amountKurus <= 0 ||
      (order.refundedKurus ?? 0) + amountKurus > orderTotalKurus) {
      throw new Error("İade tutarı kalan sipariş tutarını aşıyor.");
    }

    const now = Date.now();
    const refundId = await ctx.db.insert("refunds", {
      orderId,
      paymentId: payment._id,
      provider: payment.provider,
      idempotencyKey,
      status: "pending",
      amountKurus,
      items: refundItems,
      createdAt: now,
      updatedAt: now,
    });
    for (const item of refundItems) {
      const previous = existingItems.get(item.itemIndex);
      existingItems.set(item.itemIndex, {
        itemIndex: item.itemIndex,
        quantity: (previous?.quantity ?? 0) + item.quantity,
        amountKurus: (previous?.amountKurus ?? 0) + item.amountKurus,
      });
    }
    await ctx.db.patch(orderId, {
      refundedKurus: (order.refundedKurus ?? 0) + amountKurus,
      refundedItems: [...existingItems.values()].sort((a, b) => a.itemIndex - b.itemIndex),
    });
    return {
      kind: "created",
      refundId,
      orderId,
      paymentId: payment._id,
      provider: payment.provider,
      ...(payment.paymentId ? { providerPaymentId: payment.paymentId } : {}),
      ...(payment.merchantOid ? { merchantOid: payment.merchantOid } : {}),
      idempotencyKey,
      amountKurus,
      status: "pending",
    };
  },
});

export const completeRefund = internalMutation({
  args: {
    refundId: v.id("refunds"),
    status: v.union(v.literal("succeeded"), v.literal("failed"), v.literal("review")),
    providerReference: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const refund = await ctx.db.get(args.refundId);
    if (!refund || refund.status !== "pending") return null;
    await ctx.db.patch(refund._id, {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.providerReference ? { providerReference: args.providerReference.slice(0, 200) } : {}),
      ...(args.errorMessage ? { errorMessage: args.errorMessage.slice(0, 200) } : {}),
    });
    if (args.status !== "failed") return null;

    const order = await ctx.db.get(refund.orderId);
    if (!order) return null;
    const refundedItems = new Map((order.refundedItems ?? []).map((item) => [item.itemIndex, item]));
    for (const item of refund.items) {
      const previous = refundedItems.get(item.itemIndex);
      if (!previous) continue;
      const quantity = Math.max(0, previous.quantity - item.quantity);
      const amountKurus = Math.max(0, previous.amountKurus - item.amountKurus);
      if (quantity === 0 && amountKurus === 0) refundedItems.delete(item.itemIndex);
      else refundedItems.set(item.itemIndex, { itemIndex: item.itemIndex, quantity, amountKurus });
    }
    await ctx.db.patch(order._id, {
      refundedKurus: Math.max(0, (order.refundedKurus ?? 0) - refund.amountKurus),
      refundedItems: [...refundedItems.values()].sort((a, b) => a.itemIndex - b.itemIndex),
    });
    return null;
  },
});

async function iyzicoRefund(paymentId: string, amountKurus: number, idempotencyKey: string) {
  const apiKey = env.IYZICO_API_KEY;
  const secretKey = env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("iyzico iade ayarları yapılandırılmamış.");
  const base = env.IYZICO_BASE_URL ?? "https://api.iyzipay.com";
  if (base !== "https://api.iyzipay.com" && base !== "https://sandbox-api.iyzipay.com") {
    throw new Error("iyzico adresi geçersiz.");
  }
  const path = "/v2/payment/refund";
  const body = JSON.stringify({
    locale: "tr",
    conversationId: idempotencyKey,
    paymentId,
    price: (amountKurus / 100).toFixed(2),
    currency: "TRY",
  });
  const randomKey = `${Date.now()}${crypto.randomUUID().replaceAll("-", "")}`;
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(`${randomKey}${path}${body}`),
  )), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const authorization = btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`);
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `IYZWSv2 ${authorization}`, "Content-Type": "application/json", "x-iyzi-rnd": randomKey },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object") throw new Error("İade sağlayıcısı yanıtı doğrulanamadı.");
  return result as Record<string, unknown>;
}

async function paytrRefund(merchantOid: string, amountKurus: number) {
  const merchantId = env.PAYTR_MERCHANT_ID;
  const merchantKey = env.PAYTR_MERCHANT_KEY;
  const merchantSalt = env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) throw new Error("PayTR iade ayarları yapılandırılmamış.");
  const returnAmount = (amountKurus / 100).toFixed(2);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(merchantKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${merchantId}${merchantOid}${returnAmount}${merchantSalt}`),
  ));
  const token = btoa(String.fromCharCode(...signature));
  const response = await fetch("https://www.paytr.com/odeme/iade", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      merchant_id: merchantId,
      merchant_oid: merchantOid,
      return_amount: returnAmount,
      paytr_token: token,
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object") throw new Error("İade sağlayıcısı yanıtı doğrulanamadı.");
  return result as Record<string, unknown>;
}

export const refundOrder = action({
  args: {
    adminSecret: v.string(),
    orderId: v.id("orders"),
    items: refundItemsValidator,
    idempotencyKey: v.string(),
  },
  returns: v.object({ status: refundStatusValidator, amountKurus: v.number(), message: v.string() }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const begin: BeginRefundResult = await ctx.runMutation(internal.refunds.beginRefund, {
      orderId: args.orderId,
      items: args.items,
      idempotencyKey: args.idempotencyKey,
    });
    if (begin.kind === "existing") {
      return {
        status: begin.status,
        amountKurus: begin.amountKurus,
        message: begin.status === "succeeded" ? "İade tamamlandı." : begin.status === "failed" ? "İade sağlayıcı tarafından reddedildi." : "İade sonucu bekleniyor; aynı istek tekrar gönderilmedi.",
      };
    }

    if (begin.provider === "paytr" &&
      (!env.PAYTR_MERCHANT_ID || !env.PAYTR_MERCHANT_KEY || !env.PAYTR_MERCHANT_SALT)) {
      await ctx.runMutation(internal.refunds.completeRefund, {
        refundId: begin.refundId,
        status: "failed",
        errorMessage: "provider_not_configured",
      });
      return { status: "failed" as const, amountKurus: begin.amountKurus, message: "PayTR iade ayarları yapılandırılmamış." };
    }
    if (begin.provider === "iyzico" && (!env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY)) {
      await ctx.runMutation(internal.refunds.completeRefund, {
        refundId: begin.refundId,
        status: "failed",
        errorMessage: "provider_not_configured",
      });
      return { status: "failed" as const, amountKurus: begin.amountKurus, message: "iyzico iade ayarları yapılandırılmamış." };
    }

    try {
      const result = begin.provider === "paytr"
        ? await paytrRefund(begin.merchantOid!, begin.amountKurus)
        : await iyzicoRefund(begin.providerPaymentId!, begin.amountKurus, begin.idempotencyKey);
      const success = result.status === "success";
      const returnedAmount = begin.provider === "paytr"
        ? Math.round(Number(result.return_amount) * 100)
        : Math.round(Number(result.price) * 100);
      if (success && returnedAmount === begin.amountKurus) {
        const providerReference = begin.provider === "paytr"
          ? typeof result.reference_no === "string" ? result.reference_no : undefined
          : typeof result.refundHostReference === "string" ? result.refundHostReference : undefined;
        await ctx.runMutation(internal.refunds.completeRefund, {
          refundId: begin.refundId,
          status: "succeeded",
          ...(providerReference ? { providerReference } : {}),
        });
        return { status: "succeeded" as const, amountKurus: begin.amountKurus, message: "İade tamamlandı." };
      }
      if (!success) {
        await ctx.runMutation(internal.refunds.completeRefund, {
          refundId: begin.refundId,
          status: "failed",
          errorMessage: "provider_rejected",
        });
        return { status: "failed" as const, amountKurus: begin.amountKurus, message: "Ödeme sağlayıcısı iadeyi reddetti." };
      }
      await ctx.runMutation(internal.refunds.completeRefund, {
        refundId: begin.refundId,
        status: "review",
        errorMessage: "provider_amount_mismatch",
      });
      return { status: "review" as const, amountKurus: begin.amountKurus, message: "Sağlayıcı yanıtındaki tutar uyuşmadı; iade panelden kontrol edilmeli." };
    } catch {
      await ctx.runMutation(internal.refunds.completeRefund, {
        refundId: begin.refundId,
        status: "review",
        errorMessage: "provider_result_unknown",
      });
      return { status: "review" as const, amountKurus: begin.amountKurus, message: "İade sonucu doğrulanamadı; mükerrer iade riskini önlemek için aynı istek yeniden gönderilmedi." };
    }
  },
});
