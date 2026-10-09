import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";

const eventValidator = v.literal("payment_confirmation");
const eventRecordValidator = schema.doc("orderEmailEvents");
const emailPayloadValidator = v.object({
  orderId: v.id("orders"),
  event: eventValidator,
  customerEmail: v.string(),
  customerName: v.string(),
  total: v.string(),
  itemCount: v.number(),
  items: v.array(v.object({ title: v.string(), quantity: v.number(), price: v.string() })),
});

type EmailEvent = "payment_confirmation";
type EmailPayload = {
  orderId: Id<"orders">;
  event: EmailEvent;
  customerEmail: string;
  customerName: string;
  total: string;
  itemCount: number;
  items: { title: string; quantity: number; price: string }[];
};

export const getOrderEmailPayload = internalQuery({
  args: { orderId: v.id("orders"), event: eventValidator },
  returns: v.union(emailPayloadValidator, v.null()),
  handler: async (ctx, { orderId, event }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    if (order.status !== "paid") return null;
    return {
      orderId,
      event,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      total: order.total,
      itemCount: order.items.length,
      items: order.items.slice(0, 20).map((item) => ({ title: item.title, quantity: item.quantity, price: item.price })),
    };
  },
});

export const beginSend = internalMutation({
  args: { orderId: v.id("orders"), event: eventValidator },
  returns: v.union(v.id("orderEmailEvents"), v.null()),
  handler: async (ctx, { orderId, event }) => {
    const now = Date.now();
    const existing = await ctx.db.query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) => q.eq("orderId", orderId).eq("event", event))
      .unique();
    if (existing?.status === "sent" || existing?.status === "review") return null;
    if (existing?.status === "processing") {
      if ((existing.leaseUntil ?? 0) > now) return null;
      await ctx.db.patch(existing._id, {
        status: "review",
        error: "E-posta gönderiminin sonucu doğrulanamadı. Gönderici kutusunu kontrol etmeden tekrar göndermeyin.",
        leaseUntil: undefined,
      });
      return null;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "processing",
        error: undefined,
        leaseUntil: now + 60_000,
      });
      return existing._id;
    }
    return await ctx.db.insert("orderEmailEvents", {
      orderId,
      event,
      status: "processing",
      idempotencyKey: `order-confirmation/${orderId}`,
      leaseUntil: now + 60_000,
    });
  },
});

export const recordSendResult = internalMutation({
  args: {
    eventId: v.id("orderEmailEvents"),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("not_configured"), v.literal("review")),
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

export const listForOrdersAdmin = query({
  args: { adminSecret: v.string(), orderIds: v.array(v.id("orders")) },
  returns: v.array(eventRecordValidator),
  handler: async (ctx, { adminSecret, orderIds }) => {
    assertAdminApiSecret(adminSecret);
    if (orderIds.length > 100) throw new Error("En fazla 100 sipariş için bildirim durumu alınabilir.");
    const events = await Promise.all(orderIds.map((orderId) => ctx.db.query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) => q.eq("orderId", orderId))
      .order("desc")
      .take(2)));
    return events.flat();
  },
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function formatTRY(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

function buildEmail(payload: EmailPayload) {
  const orderNumber = String(payload.orderId);
  const subject = "Siparişiniz alındı";
  const itemLines = payload.items.map((item) => `${item.title} × ${item.quantity} · ${formatTRY(String(Number(item.price) * item.quantity))}`);
  const moreCount = Math.max(0, payload.itemCount - payload.items.length);
  const lineText = [...itemLines, ...(moreCount ? [`ve ${moreCount} ürün daha`] : [])].join("\n");
  const itemHtml = payload.items.map((item) => `<li>${escapeHtml(item.title)} × ${item.quantity} <span>${escapeHtml(formatTRY(String(Number(item.price) * item.quantity)))}</span></li>`).join("");
  const text = `Merhaba ${payload.customerName},\n\n${subject}.\nSipariş no: ${orderNumber}\n\n${lineText}\n\nToplam: ${formatTRY(payload.total)}\nASHLESHA`;
  const moreHtml = moreCount ? `<li>ve ${moreCount} ürün daha</li>` : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:600px;margin:auto"><h1 style="font-size:22px">${escapeHtml(subject)}</h1><p>Merhaba ${escapeHtml(payload.customerName)},</p><p>Sipariş numaranız: <strong>${escapeHtml(orderNumber)}</strong></p><ul>${itemHtml}${moreHtml}</ul><p style="font-size:18px"><strong>Toplam: ${escapeHtml(formatTRY(payload.total))}</strong></p><p>ASHLESHA</p></div>`;
  return { subject, text, html };
}

export const sendForOrderScheduled = internalAction({
  args: { orderId: v.id("orders"), event: eventValidator },
  returns: v.null(),
  handler: async (ctx, { orderId, event }) => {
    const payload: EmailPayload | null = await ctx.runQuery(internal.notifications.getOrderEmailPayload, { orderId, event });
    if (!payload) return null;
    const eventId = await ctx.runMutation(internal.notifications.beginSend, { orderId, event });
    if (!eventId) return null;
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.ORDER_FROM_EMAIL?.trim();
    if (!apiKey || !from) {
      await ctx.runMutation(internal.notifications.recordSendResult, {
        eventId,
        status: "not_configured",
        error: "RESEND_API_KEY ve ORDER_FROM_EMAIL yapılandırılmalı.",
      });
      return null;
    }

    const content = buildEmail(payload);
    const record = await ctx.runQuery(internal.notifications.getEventById, { eventId });
    if (!record) return null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": record.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [payload.customerEmail],
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        await ctx.runMutation(internal.notifications.recordSendResult, {
          eventId,
          status: "sent",
        });
      } else {
        await ctx.runMutation(internal.notifications.recordSendResult, {
          eventId,
          status: response.status >= 500 ? "review" : "failed",
          error: `Resend HTTP ${response.status} yanıtı döndürdü.`,
        });
      }
    } catch {
      await ctx.runMutation(internal.notifications.recordSendResult, {
        eventId,
        status: "review",
        error: "E-posta gönderiminin sonucu doğrulanamadı. Mükerrer gönderimi önlemek için Resend panelinde kontrol edin.",
      });
    }
    return null;
  },
});

export const getEventById = internalQuery({
  args: { eventId: v.id("orderEmailEvents") },
  returns: v.union(eventRecordValidator, v.null()),
  handler: async (ctx, { eventId }) => await ctx.db.get(eventId),
});

export const retry = mutation({
  args: { adminSecret: v.string(), orderId: v.id("orders"), event: eventValidator },
  returns: v.null(),
  handler: async (ctx, { adminSecret, orderId, event }) => {
    assertAdminApiSecret(adminSecret);
    const order = await ctx.db.get(orderId);
    const canRetry = order?.status === "paid";
    if (!canRetry) throw new Error("Bu e-posta türü için sipariş durumu uygun değil.");
    const existing = await ctx.db.query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) => q.eq("orderId", orderId).eq("event", event))
      .unique();
    if (existing?.status === "review") throw new Error("Gönderim sonucu belirsiz. Resend panelini kontrol edin; otomatik tekrar kapalı.");
    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event });
    return null;
  },
});
