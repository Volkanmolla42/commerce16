import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { action, env, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const shipmentValidator = schema.doc("shippingShipments");
const offerValidator = v.object({
  id: v.string(),
  carrierName: v.string(),
  serviceName: v.string(),
  priceKurus: v.number(),
  currency: v.string(),
  estimatedDays: v.optional(v.number()),
});
const orderForShippingValidator = v.object({
  _id: v.id("orders"),
  status: v.union(v.literal("pending"), v.literal("paid"), v.literal("shipped"), v.literal("delivered"), v.literal("cancelled")),
  customerEmail: v.string(),
  customerName: v.string(),
  customerPhone: v.optional(v.string()),
  total: v.string(),
  shippingAddress: v.optional(v.string()),
  city: v.optional(v.string()),
  district: v.optional(v.string()),
  provinceId: v.optional(v.string()),
});

type ShippingOrder = {
  _id: Id<"orders">;
  status: Doc<"orders">["status"];
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  total: string;
  shippingAddress?: string;
  city?: string;
  district?: string;
  provinceId?: string;
};
type ShippingOffer = {
  id: string;
  carrierName: string;
  serviceName: string;
  priceKurus: number;
  currency: string;
  estimatedDays?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 300);
  }
  return undefined;
}

function safeExternalUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseKurus(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return null;
  const kurus = Math.round(amount * 100);
  return Number.isSafeInteger(kurus) ? kurus : null;
}

function parseOffers(value: unknown): ShippingOffer[] {
  const rawOffers = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.list)
      ? value.list
      : [];
  return rawOffers.flatMap((candidate): ShippingOffer[] => {
    if (!isRecord(candidate)) return [];
    const id = textField(candidate, "id", "offerID", "offerId");
    const priceKurus = parseKurus(candidate.amount ?? candidate.price ?? candidate.totalAmount ?? candidate.providerTotalAmount);
    if (!id || priceKurus === null) return [];
    const estimatedDays = candidate.estimatedDeliveryDays ?? candidate.deliveryDays ?? candidate.transitDays;
    return [{
      id,
      carrierName: textField(candidate, "providerName", "carrierName", "providerCode", "provider") ?? "Kargo firması",
      serviceName: textField(candidate, "providerServiceName", "serviceName", "name", "providerServiceCode") ?? "Standart teslimat",
      priceKurus,
      currency: textField(candidate, "currency", "totalAmountCurrency") ?? "TRY",
      ...(typeof estimatedDays === "number" && Number.isSafeInteger(estimatedDays) && estimatedDays > 0
        ? { estimatedDays }
        : {}),
    }];
  }).slice(0, 20);
}

function envelopeData(value: unknown) {
  if (!isRecord(value)) throw new GeliverRequestError("invalid_response");
  if (value.result === false) throw new GeliverRequestError("provider_rejected", 400);
  return isRecord(value.data) ? value.data : value;
}

class GeliverRequestError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super(code);
  }
}

async function geliverRequest(path: string, method = "GET", body?: Record<string, unknown>) {
  const token = env.GELIVER_TOKEN;
  if (!token) throw new GeliverRequestError("not_configured", 0);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`https://api.geliver.io/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const responseBody: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new GeliverRequestError(response.status >= 400 && response.status < 500 ? "provider_rejected" : "provider_unavailable", response.status);
    return envelopeData(responseBody);
  } catch (error) {
    if (error instanceof GeliverRequestError) throw error;
    throw new GeliverRequestError("provider_result_unknown");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0090")) return `+${digits.slice(2)}`;
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("5")) return `+90${digits}`;
  return digits;
}

function positiveMeasurement(value: string | undefined, fallback: string, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return fallback;
  return parsed.toFixed(1);
}

function isTestMode() {
  return env.GELIVER_TEST_MODE !== "0" && env.GELIVER_TEST_MODE !== "false";
}

function isConfigured() {
  return Boolean(env.GELIVER_TOKEN && env.GELIVER_SENDER_ADDRESS_ID && env.GELIVER_SOURCE_IDENTIFIER);
}

function getSourceIdentifier() {
  const raw = env.GELIVER_SOURCE_IDENTIFIER;
  if (!raw) throw new GeliverRequestError("not_configured", 0);
  try {
    const source = new URL(raw);
    if (source.protocol !== "https:" && source.hostname !== "localhost") throw new GeliverRequestError("invalid_store_url", 0);
    return source.toString();
  } catch (error) {
    if (error instanceof GeliverRequestError) throw error;
    throw new GeliverRequestError("invalid_store_url", 0);
  }
}

function offerListFromShipment(shipment: Record<string, unknown>) {
  return parseOffers(shipment.offers);
}

function offerUrlDetails(shipment: Record<string, unknown>) {
  return {
    ...(textField(shipment, "trackingNumber") ? { trackingNumber: textField(shipment, "trackingNumber") } : {}),
    ...(safeExternalUrl(shipment.trackingUrl ?? shipment.trackingURL) ? { trackingUrl: safeExternalUrl(shipment.trackingUrl ?? shipment.trackingURL) } : {}),
    ...(safeExternalUrl(shipment.labelURL ?? shipment.labelUrl) ? { labelUrl: safeExternalUrl(shipment.labelURL ?? shipment.labelUrl) } : {}),
    ...(textField(shipment, "barcode") ? { barcode: textField(shipment, "barcode") } : {}),
  };
}

export const listAllAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(shipmentValidator),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    return await ctx.db.query("shippingShipments").order("desc").take(200);
  },
});

export const getOrderForShipping = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.union(orderForShippingValidator, v.null()),
  handler: async (ctx, { orderId }): Promise<ShippingOrder | null> => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    return {
      _id: order._id,
      status: order.status,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      ...(order.customerPhone ? { customerPhone: order.customerPhone } : {}),
      total: order.total,
      ...(order.shippingAddress ? { shippingAddress: order.shippingAddress } : {}),
      ...(order.city ? { city: order.city } : {}),
      ...(order.district ? { district: order.district } : {}),
      ...(order.provinceId ? { provinceId: order.provinceId } : {}),
    };
  },
});

export const getLatestForOrder = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.union(shipmentValidator, v.null()),
  handler: async (ctx, { orderId }) => await ctx.db.query("shippingShipments")
    .withIndex("by_order_and_created_at", (q) => q.eq("orderId", orderId))
    .order("desc")
    .first(),
});

export const beginShipment = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.union(v.id("shippingShipments"), v.null()),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "paid") return null;
    const latest = await ctx.db.query("shippingShipments")
      .withIndex("by_order_and_created_at", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    if (latest && latest.status !== "failed") return null;
    const now = Date.now();
    return await ctx.db.insert("shippingShipments", {
      orderId,
      status: "creating",
      offers: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveShipmentQuote = internalMutation({
  args: {
    shippingShipmentId: v.id("shippingShipments"),
    geliverShipmentId: v.string(),
    offers: v.array(offerValidator),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    barcode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.shippingShipmentId);
    if (!record || record.status !== "creating") return null;
    await ctx.db.patch(record._id, {
      status: "quoted",
      geliverShipmentId: args.geliverShipmentId.slice(0, 200),
      offers: args.offers,
      ...(args.trackingNumber ? { trackingNumber: args.trackingNumber.slice(0, 200) } : {}),
      ...(args.trackingUrl ? { trackingUrl: args.trackingUrl } : {}),
      ...(args.labelUrl ? { labelUrl: args.labelUrl } : {}),
      ...(args.barcode ? { barcode: args.barcode.slice(0, 200) } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markShipmentFailure = internalMutation({
  args: {
    shippingShipmentId: v.id("shippingShipments"),
    status: v.union(v.literal("failed"), v.literal("review")),
    errorCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.shippingShipmentId);
    if (!record || (record.status !== "creating" && record.status !== "purchasing")) return null;
    await ctx.db.patch(record._id, {
      status: args.status,
      errorCode: args.errorCode.slice(0, 80),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const beginPurchase = internalMutation({
  args: { orderId: v.id("orders"), offerId: v.string() },
  returns: v.union(v.object({ shippingShipmentId: v.id("shippingShipments"), offerId: v.string(), carrierName: v.string() }), v.null()),
  handler: async (ctx, { orderId, offerId }) => {
    if (offerId.length < 1 || offerId.length > 200) return null;
    const record = await ctx.db.query("shippingShipments")
      .withIndex("by_order_and_created_at", (q) => q.eq("orderId", orderId))
      .order("desc")
      .first();
    if (!record || record.status !== "quoted") return null;
    const offer = record.offers.find((candidate) => candidate.id === offerId);
    if (!offer) return null;
    await ctx.db.patch(record._id, { status: "purchasing", updatedAt: Date.now() });
    return { shippingShipmentId: record._id, offerId, carrierName: offer.carrierName };
  },
});

export const completePurchase = internalMutation({
  args: {
    shippingShipmentId: v.id("shippingShipments"),
    transactionId: v.optional(v.string()),
    geliverShipmentId: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    barcode: v.optional(v.string()),
    carrierName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.shippingShipmentId);
    if (!record || record.status !== "purchasing") return null;
    await ctx.db.patch(record._id, {
      status: "purchased",
      carrierName: args.carrierName.slice(0, 120),
      ...(args.transactionId ? { transactionId: args.transactionId.slice(0, 200) } : {}),
      ...(args.geliverShipmentId ? { geliverShipmentId: args.geliverShipmentId.slice(0, 200) } : {}),
      ...(args.trackingNumber ? { trackingNumber: args.trackingNumber.slice(0, 200) } : {}),
      ...(args.trackingUrl ? { trackingUrl: args.trackingUrl } : {}),
      ...(args.labelUrl ? { labelUrl: args.labelUrl } : {}),
      ...(args.barcode ? { barcode: args.barcode.slice(0, 200) } : {}),
      purchasedAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (args.trackingNumber) {
      const order = await ctx.db.get(record.orderId);
      if (order?.status === "shipped") {
        await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, {
          orderId: record.orderId,
          event: "shipping_update",
        });
      }
    }
    return null;
  },
});

export const updateOffers = internalMutation({
  args: { shippingShipmentId: v.id("shippingShipments"), offers: v.array(offerValidator) },
  returns: v.null(),
  handler: async (ctx, { shippingShipmentId, offers }) => {
    const record = await ctx.db.get(shippingShipmentId);
    if (!record || record.status !== "quoted") return null;
    await ctx.db.patch(shippingShipmentId, { offers, updatedAt: Date.now() });
    return null;
  },
});

export const updateTracking = internalMutation({
  args: {
    shippingShipmentId: v.id("shippingShipments"),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    barcode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.shippingShipmentId);
    if (!record || record.status !== "purchased") return null;
    await ctx.db.patch(record._id, {
      ...(args.trackingNumber ? { trackingNumber: args.trackingNumber.slice(0, 200) } : {}),
      ...(args.trackingUrl ? { trackingUrl: args.trackingUrl } : {}),
      ...(args.labelUrl ? { labelUrl: args.labelUrl } : {}),
      ...(args.barcode ? { barcode: args.barcode.slice(0, 200) } : {}),
      updatedAt: Date.now(),
    });
    if (args.trackingNumber || record.trackingNumber) {
      const order = await ctx.db.get(record.orderId);
      if (order?.status === "shipped") {
        await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, {
          orderId: record.orderId,
          event: "shipping_update",
        });
      }
    }
    return null;
  },
});

async function latestRecord(ctx: ActionCtx, orderId: Id<"orders">): Promise<Doc<"shippingShipments"> | null> {
  return await ctx.runQuery(internal.shipping.getLatestForOrder, { orderId });
}

async function createForPaidOrder(
  ctx: ActionCtx,
  orderId: Id<"orders">,
): Promise<{ record: Doc<"shippingShipments"> | null; message: string; isError: boolean }> {
  if (!isConfigured()) return { record: null, message: "Geliver için token, gönderici adresi ve mağaza URL'si ayarlanmalı.", isError: true };
  const order: ShippingOrder | null = await ctx.runQuery(internal.shipping.getOrderForShipping, { orderId });
  if (!order || order.status !== "paid") return { record: null, message: "Yalnızca ödemesi alınmış sipariş için gönderi oluşturulur.", isError: true };
  const shippingAddressId: Id<"shippingShipments"> | null = await ctx.runMutation(internal.shipping.beginShipment, { orderId });
  if (!shippingAddressId) {
    return { record: await latestRecord(ctx, orderId), message: "Bu sipariş için kargo kaydı zaten var veya oluşturulamıyor.", isError: true };
  }
  try {
    const phone = order.customerPhone ? normalizePhone(order.customerPhone) : "";
    if (!/^\+?\d{10,15}$/.test(phone)) throw new GeliverRequestError("recipient_phone_missing", 400);
    if (!order.shippingAddress || order.shippingAddress.trim().length < 5 || !order.city || !order.district || !order.provinceId) {
      throw new GeliverRequestError("recipient_address_incomplete", 400);
    }
    const totalAmount = Number(order.total);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new GeliverRequestError("order_total_invalid", 400);
    const result = await geliverRequest("/shipments", "POST", {
      senderAddressID: env.GELIVER_SENDER_ADDRESS_ID!,
      recipientAddress: {
        name: order.customerName.trim().slice(0, 100),
        email: order.customerEmail.trim().slice(0, 200),
        phone,
        address1: order.shippingAddress.trim().slice(0, 400),
        countryCode: "TR",
        cityName: order.city,
        cityCode: order.provinceId,
        districtName: order.district,
      },
      length: positiveMeasurement(env.GELIVER_PACKAGE_LENGTH_CM, "25.0", 300),
      width: positiveMeasurement(env.GELIVER_PACKAGE_WIDTH_CM, "20.0", 300),
      height: positiveMeasurement(env.GELIVER_PACKAGE_HEIGHT_CM, "10.0", 300),
      distanceUnit: "cm",
      weight: positiveMeasurement(env.GELIVER_PACKAGE_WEIGHT_KG, "1.0", 70),
      massUnit: "kg",
      test: isTestMode(),
      order: {
        orderNumber: String(order._id),
        sourceIdentifier: getSourceIdentifier(),
        totalAmount: totalAmount.toFixed(2),
        totalAmountCurrency: "TRY",
      },
    });
    const geliverShipmentId = textField(result, "id", "shipmentID", "shipmentId");
    if (!geliverShipmentId) throw new GeliverRequestError("shipment_reference_missing");
    await ctx.runMutation(internal.shipping.saveShipmentQuote, {
      shippingShipmentId: shippingAddressId,
      geliverShipmentId,
      offers: offerListFromShipment(result),
      ...offerUrlDetails(result),
    });
  } catch (error) {
    const code = error instanceof GeliverRequestError ? error.code : "provider_result_unknown";
    const status = error instanceof GeliverRequestError && error.status !== undefined && error.status >= 400 && error.status < 500
      ? "failed"
      : "review";
    await ctx.runMutation(internal.shipping.markShipmentFailure, {
      shippingShipmentId: shippingAddressId,
      status,
      errorCode: code,
    });
  }
  const record = await latestRecord(ctx, orderId);
  const isError = record?.status === "failed" || record?.status === "review";
  return { record, message: isError ? "Geliver gönderi kaydı oluşturulamadı veya sonucu inceleme gerektiriyor." : "Geliver gönderi kaydı güncellendi.", isError };
}

export const createForPaidOrderScheduled = internalAction({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    await createForPaidOrder(ctx, orderId);
    return null;
  },
});

export const createForPaidOrderAdmin = action({
  args: { adminSecret: v.string(), orderId: v.id("orders") },
  returns: v.object({ record: v.union(shipmentValidator, v.null()), message: v.string(), isError: v.boolean() }),
  handler: async (ctx, { adminSecret, orderId }) => {
    assertAdminApiSecret(adminSecret);
    return await createForPaidOrder(ctx, orderId);
  },
});

export const refreshOffersAdmin = action({
  args: { adminSecret: v.string(), orderId: v.id("orders") },
  returns: v.object({ record: v.union(shipmentValidator, v.null()), message: v.string(), isError: v.boolean() }),
  handler: async (ctx, { adminSecret, orderId }) => {
    assertAdminApiSecret(adminSecret);
    const record = await latestRecord(ctx, orderId);
    if (!record?.geliverShipmentId || (record.status !== "quoted" && record.status !== "purchased")) {
      return { record, message: "Teklifler yenilenemiyor. Önce gönderi kaydı oluşturun.", isError: true };
    }
    try {
      const shipment = await geliverRequest(`/shipments/${encodeURIComponent(record.geliverShipmentId)}`);
      if (record.status === "purchased") {
        await ctx.runMutation(internal.shipping.updateTracking, {
          shippingShipmentId: record._id,
          ...offerUrlDetails(shipment),
        });
        return { record: await latestRecord(ctx, orderId), message: "Kargo takip bilgileri yenilendi.", isError: false };
      }
      await ctx.runMutation(internal.shipping.updateOffers, { shippingShipmentId: record._id, offers: offerListFromShipment(shipment) });
      return { record: await latestRecord(ctx, orderId), message: "Kargo teklifleri yenilendi.", isError: false };
    } catch {
      return { record, message: "Geliver teklifleri şu an alınamadı.", isError: true };
    }
  },
});

export const purchaseLabelAdmin = action({
  args: { adminSecret: v.string(), orderId: v.id("orders"), offerId: v.string() },
  returns: v.object({ record: v.union(shipmentValidator, v.null()), message: v.string(), isError: v.boolean() }),
  handler: async (ctx, { adminSecret, orderId, offerId }) => {
    assertAdminApiSecret(adminSecret);
    const purchase = await ctx.runMutation(internal.shipping.beginPurchase, { orderId, offerId });
    if (!purchase) {
      return { record: await latestRecord(ctx, orderId), message: "Teklif kullanılamıyor veya satın alma zaten başlatıldı.", isError: true };
    }
    try {
      const transaction = await geliverRequest("/transactions", "POST", { offerID: purchase.offerId });
      const shipment = isRecord(transaction.shipment) ? transaction.shipment : transaction;
      const transactionId = textField(transaction, "id", "transactionID", "transactionId");
      const geliverShipmentId = textField(shipment, "id", "shipmentID", "shipmentId");
      if (!transactionId && !geliverShipmentId) throw new GeliverRequestError("transaction_reference_missing");
      await ctx.runMutation(internal.shipping.completePurchase, {
        shippingShipmentId: purchase.shippingShipmentId,
        carrierName: purchase.carrierName,
        ...(transactionId ? { transactionId } : {}),
        ...(geliverShipmentId ? { geliverShipmentId } : {}),
        ...offerUrlDetails(shipment),
      });
    } catch (error) {
      const code = error instanceof GeliverRequestError ? error.code : "provider_result_unknown";
      await ctx.runMutation(internal.shipping.markShipmentFailure, {
        shippingShipmentId: purchase.shippingShipmentId,
        status: "review",
        errorCode: code,
      });
    }
    const record = await latestRecord(ctx, orderId);
    const isError = record?.status !== "purchased";
    return {
      record,
      message: isError ? "Etiket sonucu belirsiz; kargo panelinden incelenmeli." : "Kargo etiketi satın alındı.",
      isError,
    };
  },
});
