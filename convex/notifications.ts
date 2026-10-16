import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import { readPaymentSettings } from "./payments";
import { readStoreSettings } from "./settings";
import { formatOrderCode, resolveCarrierTrackingUrl } from "../lib/orders";
import { adminAlertTo } from "./emails/config";
import {
  canSendOrderEvent,
  isRetryableOrderEvent,
  orderEmailEventValidator,
  type OrderEmailEvent,
} from "./emails/events";
import {
  orderEmailPayloadValidator,
  renderOrderEmail,
  type OrderEmailPayload,
} from "./emails/templates/order";
import { sendEmail } from "./emails/send";

const SEND_LEASE_MS = 60_000;

/** Aynı olayın Resend tarafında da tekrarlanmaması için kullanılan anahtar. */
function emailIdempotencyKey(orderId: string, event: OrderEmailEvent): string {
  return `${event}/${orderId}`;
}

export const getOrderEmailPayload = internalQuery({
  args: { orderId: v.id("orders"), event: orderEmailEventValidator },
  returns: v.union(orderEmailPayloadValidator, v.null()),
  handler: async (ctx, { orderId, event }): Promise<OrderEmailPayload | null> => {
    const order = await ctx.db.get(orderId);
    if (!order || !canSendOrderEvent(event, order.status)) return null;

    const settings = await readStoreSettings(ctx);

    const bankAccounts: OrderEmailPayload["bankAccounts"] = [];
    let bankTransferInstructions = "";
    if (order.paymentMethod === "bank_transfer") {
      const { bankTransfer } = await readPaymentSettings(ctx);
      bankAccounts.push(
        ...bankTransfer.accounts.map((account) => ({
          bankName: account.bankName,
          accountHolder: account.accountHolder,
          iban: account.iban,
        }))
      );
      bankTransferInstructions = bankTransfer.description.trim();
    }

    return {
      event,
      orderCode: formatOrderCode(order._id),
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress?.trim() || null,
      total: order.total,
      couponCode: order.couponCode?.trim() || null,
      couponDiscountKurus: order.couponDiscountKurus ?? null,
      createdAt: order._creationTime,
      carrier: order.carrier?.trim() || null,
      trackingNumber: order.trackingNumber?.trim() || null,
      trackingUrl:
        order.trackingUrl?.trim() ||
        resolveCarrierTrackingUrl(order.carrier, order.trackingNumber) ||
        null,
      itemCount: order.items.length,
      items: order.items.slice(0, 30).map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        image: item.image ?? null,
        sku: item.sku ?? null,
      })),
      storeName: settings.storeName,
      storeEmail: settings.email.trim() || null,
      storePhone: settings.phone.trim() || null,
      paymentMethod: order.paymentMethod ?? null,
      paymentMethodTitle: order.paymentMethodTitle ?? null,
      paymentFee: order.paymentFee ?? null,
      bankAccounts,
      bankTransferInstructions,
    };
  },
});

/**
 * Aynı olayun iki kez gönderilmesini engelleyen kiralamalı kayıt.
 * `null` dönerse gönderim ya zaten yapılmış ya da sonucu belirsizdir.
 */
export const beginSend = internalMutation({
  args: { orderId: v.id("orders"), event: orderEmailEventValidator },
  returns: v.union(v.id("orderEmailEvents"), v.null()),
  handler: async (ctx, { orderId, event }) => {
    const order = await ctx.db.get(orderId);
    if (!order || !canSendOrderEvent(event, order.status)) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) =>
        q.eq("orderId", orderId).eq("event", event)
      )
      .unique();

    if (!existing) {
      return await ctx.db.insert("orderEmailEvents", {
        orderId,
        event,
        status: "processing",
        leaseUntil: now + SEND_LEASE_MS,
      });
    }

    if (existing.status === "sent" || existing.status === "review") return null;
    if (existing.status === "processing") {
      if ((existing.leaseUntil ?? 0) > now) return null;
      await ctx.db.patch(existing._id, {
        status: "review",
        error:
          "E-posta gönderiminin sonucu doğrulanamadı. Gönderici kutusunu kontrol etmeden tekrar göndermeyin.",
        leaseUntil: undefined,
      });
      return null;
    }

    await ctx.db.patch(existing._id, {
      status: "processing",
      error: undefined,
      leaseUntil: now + SEND_LEASE_MS,
    });
    return existing._id;
  },
});

const sendStatusValidator = v.union(
  v.literal("sent"),
  v.literal("failed"),
  v.literal("not_configured"),
  v.literal("review")
);

export const recordSendResult = internalMutation({
  args: {
    eventId: v.id("orderEmailEvents"),
    status: sendStatusValidator,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status === "sent") return null;
    await ctx.db.patch(event._id, {
      status: args.status,
      ...(args.error ? { error: args.error.slice(0, 300) } : { error: undefined }),
      leaseUntil: undefined,
    });
    return null;
  },
});

export const sendForOrderScheduled = internalAction({
  args: { orderId: v.id("orders"), event: orderEmailEventValidator },
  returns: v.null(),
  handler: async (ctx, { orderId, event }) => {
    const payload = await ctx.runQuery(internal.notifications.getOrderEmailPayload, {
      orderId,
      event,
    });
    if (!payload) return null;

    const eventId = await ctx.runMutation(internal.notifications.beginSend, {
      orderId,
      event,
    });
    if (!eventId) return null;

    const isAdminAlert = event === "admin_order_alert";
    const outcome = await sendEmail(ctx, {
      to: isAdminAlert ? adminAlertTo() : payload.customerEmail,
      storeName: payload.storeName,
      templateKey: event,
      content: renderOrderEmail(payload),
      replyTo: isAdminAlert ? payload.customerEmail : payload.storeEmail || undefined,
      idempotencyKey: emailIdempotencyKey(orderId, event),
      metadata: { orderId, event, orderCode: payload.orderCode },
    });

    await ctx.runMutation(internal.notifications.recordSendResult, {
      eventId,
      status: outcome,
    });
    return null;
  },
});

export const listForOrdersAdmin = query({
  args: { adminSecret: v.string(), orderIds: v.array(v.id("orders")) },
  returns: v.array(schema.doc("orderEmailEvents")),
  handler: async (ctx, { adminSecret, orderIds }) => {
    assertAdminApiSecret(adminSecret);
    if (orderIds.length > 100) {
      throw new Error("En fazla 100 sipariş için bildirim durumu alınabilir.");
    }
    const events = await Promise.all(
      orderIds.map((orderId) =>
        ctx.db
          .query("orderEmailEvents")
          .withIndex("by_order_and_event", (q) => q.eq("orderId", orderId))
          .order("desc")
          .take(6)
      )
    );
    return events.flat();
  },
});

export const retry = mutation({
  args: {
    adminSecret: v.string(),
    orderId: v.id("orders"),
    event: orderEmailEventValidator,
  },
  returns: v.null(),
  handler: async (ctx, { adminSecret, orderId, event }) => {
    assertAdminApiSecret(adminSecret);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Sipariş bulunamadı.");
    if (!isRetryableOrderEvent(event)) {
      throw new Error("Bu e-posta türü yeniden gönderilemez.");
    }
    if (!canSendOrderEvent(event, order.status)) {
      throw new Error("Bu e-posta türü için sipariş durumu uygun değil.");
    }

    const existing = await ctx.db
      .query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) =>
        q.eq("orderId", orderId).eq("event", event)
      )
      .unique();
    if (existing?.status === "review") {
      throw new Error(
        "Gönderim sonucu belirsiz. Gönderim kutusunu kontrol edin; otomatik tekrar kapalı."
      );
    }

    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, {
      orderId,
      event,
    });
    return null;
  },
});
