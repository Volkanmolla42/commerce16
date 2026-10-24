import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import schema from "../schema";
import { patchCatalogProduct } from "../catalogModel";
import { commitCouponReservation, releaseCouponReservation, reserveCouponForOrder } from "../coupons";
import { isRevenueOrder, type OrderStatusUpdate } from "../../lib/orders";

const orderValidator = schema.doc("orders");

export const publicOrderValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  customerName: orderValidator.fields.customerName,
  customerEmail: orderValidator.fields.customerEmail,
  customerPhone: orderValidator.fields.customerPhone,
  items: orderValidator.fields.items,
  total: orderValidator.fields.total,
  couponCode: orderValidator.fields.couponCode,
  couponDiscountKurus: orderValidator.fields.couponDiscountKurus,
  promotionDiscountKurus: orderValidator.fields.promotionDiscountKurus,
  promotionTitle: orderValidator.fields.promotionTitle,
  freeShippingPromotionTitle: orderValidator.fields.freeShippingPromotionTitle,
  status: orderValidator.fields.status,
  paymentStatus: orderValidator.fields.paymentStatus,
  paidAt: orderValidator.fields.paidAt,
  shippedAt: orderValidator.fields.shippedAt,
  deliveredAt: orderValidator.fields.deliveredAt,
  carrier: orderValidator.fields.carrier,
  trackingNumber: orderValidator.fields.trackingNumber,
  trackingUrl: orderValidator.fields.trackingUrl,
  shippingAddress: orderValidator.fields.shippingAddress,
  billingType: orderValidator.fields.billingType,
  companyName: orderValidator.fields.companyName,
  taxOffice: orderValidator.fields.taxOffice,
  taxNumber: orderValidator.fields.taxNumber,
  billingAddress: orderValidator.fields.billingAddress,
  paymentMethod: orderValidator.fields.paymentMethod,
  paymentMethodTitle: orderValidator.fields.paymentMethodTitle,
  paymentFee: orderValidator.fields.paymentFee,
  shippingFee: orderValidator.fields.shippingFee,
});

export function toPublicOrder(order: Doc<"orders">) {
  return {
    _id: order._id,
    _creationTime: order._creationTime,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    items: order.items,
    total: order.total,
    couponCode: order.couponCode,
    couponDiscountKurus: order.couponDiscountKurus,
    promotionDiscountKurus: order.promotionDiscountKurus,
    promotionTitle: order.promotionTitle,
    freeShippingPromotionTitle: order.freeShippingPromotionTitle,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shippingAddress: order.shippingAddress,
    billingType: order.billingType,
    companyName: order.companyName,
    taxOffice: order.taxOffice,
    taxNumber: order.taxNumber,
    billingAddress: order.billingAddress,
    paymentMethod: order.paymentMethod,
    paymentMethodTitle: order.paymentMethodTitle,
    paymentFee: order.paymentFee,
    shippingFee: order.shippingFee,
  };
}

export async function adjustInventoryForOrder(ctx: MutationCtx, order: Doc<"orders">, direction: -1 | 1) {
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

async function syncSoldCount(ctx: MutationCtx, order: Doc<"orders">, delta: number) {
  for (const item of order.items) {
    const productId = ctx.db.normalizeId("products", item.productId);
    if (!productId) continue;
    const product = await ctx.db.get(productId);
    if (!product) continue;
    await ctx.db.patch(productId, {
      soldCount: Math.max(0, (product.soldCount ?? 0) + delta * item.quantity),
    });
  }
}

export async function changeOrderStatus(
  ctx: MutationCtx,
  id: Id<"orders">,
  opts: OrderStatusUpdate
) {
  const order = await ctx.db.get(id);
  if (!order) throw new Error("Sipariş bulunamadı.");

  const targetStatus = opts.status ?? order.status;
  let targetPaymentStatus = opts.paymentStatus ?? order.paymentStatus;

  // Kapıda ödeme teslim edildiğinde otomatik olarak ödendi ("paid") olarak işaretlenir
  if (targetStatus === "delivered" && order.paymentMethod === "cash_on_delivery" && targetPaymentStatus === "pending") {
    targetPaymentStatus = "paid";
  }

  const statusChanged = targetStatus !== order.status;
  const paymentStatusChanged = targetPaymentStatus !== order.paymentStatus;

  if (
    !statusChanged &&
    !paymentStatusChanged &&
    opts.carrier === undefined &&
    opts.trackingNumber === undefined &&
    opts.trackingUrl === undefined
  ) {
    return null;
  }

  const canceling = order.status !== "cancelled" && targetStatus === "cancelled";
  const unCanceling = order.status === "cancelled" && targetStatus !== "cancelled";

  if (canceling) {
    await releaseCouponReservation(ctx, order);
    // Stok sipariş oluşturulurken rezerve edilmişti; her iptalde geri yüklenir.
    await adjustInventoryForOrder(ctx, order, 1);
    for (const item of order.items) {
      const productId = ctx.db.normalizeId("products", item.productId);
      if (productId) {
        await ctx.scheduler.runAfter(0, internal.restock.triggerRestockCheck, {
          productId,
          variantId: item.variantId,
        });
      }
    }
  } else if (unCanceling) {
    // İptal edilen sipariş tekrar aktif duruma alınırsa stok ve kupon yeniden rezerve edilir.
    await adjustInventoryForOrder(ctx, order, -1);
    await reserveCouponForOrder(ctx, order);
  }

  if (!canceling && ((targetStatus !== "received" && targetStatus !== "cancelled") || targetPaymentStatus === "paid")) {
    await commitCouponReservation(ctx, order);
  }

  const patchData: Record<string, unknown> = {
    status: targetStatus,
    paymentStatus: targetPaymentStatus,
    ...(targetPaymentStatus === "paid" && !order.paidAt ? { paidAt: Date.now() } : {}),
    ...(targetStatus === "shipped" && !order.shippedAt ? { shippedAt: Date.now() } : {}),
    ...(targetStatus === "delivered" && !order.deliveredAt ? { deliveredAt: Date.now() } : {}),
  };

  if (opts.carrier !== undefined) patchData.carrier = opts.carrier;
  if (opts.trackingNumber !== undefined) patchData.trackingNumber = opts.trackingNumber;
  if (opts.trackingUrl !== undefined) patchData.trackingUrl = opts.trackingUrl;

  await ctx.db.patch(id, patchData);

  const wasRevenue = isRevenueOrder(order);
  const isRevenue = isRevenueOrder({ status: targetStatus, paymentStatus: targetPaymentStatus });
  if (wasRevenue !== isRevenue) {
    await syncSoldCount(ctx, order, isRevenue ? 1 : -1);
  }

  if (paymentStatusChanged && targetPaymentStatus === "paid") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "payment_confirmed" });
  }
  if (statusChanged && targetStatus === "shipped") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_shipped" });
  }
  if (statusChanged && targetStatus === "cancelled") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_cancelled" });
  }
  if (statusChanged && targetStatus === "delivered") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId: id, event: "order_delivered" });
  }
  return null;
}
