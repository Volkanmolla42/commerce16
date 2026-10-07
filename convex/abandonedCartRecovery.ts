import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  cartRecoveryConsent: { kind: "fixed window", rate: 5, period: 60 * 60 * 1000 },
});
const consentCopyVersion = "cart-reminder-v1";
const reminderDelayMs = 60 * 60 * 1000;
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const itemInputValidator = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  quantity: v.number(),
});

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanEmail(value: string) {
  const email = value.trim().normalize("NFC").toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Geçerli bir e-posta adresi girin.");
  }
  return email;
}

function cleanPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const phone = trimmed.startsWith("+")
    ? `+${digits}`
    : digits.startsWith("00")
      ? `+${digits.slice(2)}`
      : digits.startsWith("90") && digits.length === 12
        ? `+${digits}`
        : digits.startsWith("0") && digits.length === 11
          ? `+90${digits.slice(1)}`
          : digits.startsWith("5") && digits.length === 10
            ? `+90${digits}`
            : "";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Telefon numarasını +90 5xx xxx xx xx biçiminde girin.");
  }
  return phone;
}

function siteUrl() {
  const value = env.CART_RECOVERY_SITE_URL ?? env.RESTOCK_SITE_URL;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost" ? parsed : null;
  } catch {
    return null;
  }
}

function emailFrom() {
  return env.CART_RECOVERY_FROM_EMAIL ?? env.RESTOCK_FROM_EMAIL;
}

function emailEnabled() {
  return Boolean(siteUrl() && env.RESEND_API_KEY && emailFrom());
}

function whatsappFrom() {
  if (!env.TWILIO_WHATSAPP_FROM) return null;
  const sender = env.TWILIO_WHATSAPP_FROM.trim();
  return sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`;
}

function whatsappEnabled() {
  return Boolean(
    siteUrl() &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_WHATSAPP_CONTENT_SID &&
    whatsappFrom(),
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export const getAvailability = query({
  args: {},
  returns: v.object({ email: v.boolean(), whatsapp: v.boolean() }),
  handler: async () => ({ email: emailEnabled(), whatsapp: whatsappEnabled() }),
});

export const capture = mutation({
  args: {
    sessionKey: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    emailConsent: v.boolean(),
    whatsappConsent: v.boolean(),
    items: v.array(itemInputValidator),
  },
  returns: v.union(v.id("abandonedCarts"), v.null()),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{32,64}$/i.test(args.sessionKey)) throw new Error("Sepet oturumu geçersiz.");
    if (args.items.length > 100) throw new Error("Sepet en fazla 100 ürün içerebilir.");
    if (args.emailConsent && !emailEnabled()) throw new Error("E-posta hatırlatması şu anda etkin değil.");
    if (args.whatsappConsent && !whatsappEnabled()) throw new Error("WhatsApp hatırlatması şu anda etkin değil.");

    const email = args.emailConsent ? cleanEmail(args.email ?? "") : undefined;
    const whatsapp = args.whatsappConsent ? cleanPhone(args.phone ?? "") : undefined;
    const existing = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (!args.emailConsent && !args.whatsappConsent) {
      if (!existing) return null;
      const now = Date.now();
      await ctx.db.patch(existing._id, {
        items: [],
        orderId: undefined,
        email: undefined,
        whatsapp: undefined,
        emailConsent: false,
        whatsappConsent: false,
        emailOptedOutAt: existing.emailConsent ? now : existing.emailOptedOutAt,
        whatsappOptedOutAt: existing.whatsappConsent ? now : existing.whatsappOptedOutAt,
        status: "unsubscribed",
        reminderScheduled: false,
      });
      return existing._id;
    }

    const lines = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const item of args.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
        throw new Error("Sepetteki ürün adedi geçersiz.");
      }
      const productId = ctx.db.normalizeId("products", item.productId);
      const product = productId ? await ctx.db.get(productId) : null;
      if (!product || !product.availableForSale) throw new Error("Sepetinizde artık satışta olmayan bir ürün var.");
      const variants = product.variants ?? [];
      const variantId = item.variantId ?? (variants.length === 1 ? variants[0].id : undefined);
      if (variants.length && !variantId) throw new Error("Sepetinizde ürün seçeneği eksik.");
      if (variantId && !variants.some((variant) => variant.id === variantId)) {
        throw new Error("Sepetinizde geçersiz bir ürün seçeneği var.");
      }
      const key = `${item.productId}:${variantId ?? ""}`;
      const previous = lines.get(key);
      const quantity = (previous?.quantity ?? 0) + item.quantity;
      if (quantity > 999) throw new Error("Ürün adedi izin verilen sınırı aşıyor.");
      lines.set(key, {
        productId: item.productId,
        ...(variantId ? { variantId } : {}),
        quantity,
      });
    }
    if (lines.size === 0) throw new Error("Hatırlatma için sepetinizde ürün olmalı.");

    const newEmailConsent = args.emailConsent && (!existing?.emailConsent || existing.email !== email);
    const newWhatsappConsent = args.whatsappConsent && (!existing?.whatsappConsent || existing.whatsapp !== whatsapp);
    if (newEmailConsent && email) {
      await rateLimiter.limit(ctx, "cartRecoveryConsent", { key: await hash(`email:${email}`), throws: true });
    }
    if (newWhatsappConsent && whatsapp) {
      await rateLimiter.limit(ctx, "cartRecoveryConsent", { key: await hash(`whatsapp:${whatsapp}`), throws: true });
    }

    const now = Date.now();
    const needsNewReminder = !existing ||
      existing.status === "sent" || existing.status === "converted" || existing.status === "unsubscribed" ||
      existing.status === "failed" || existing.status === "expired" || newEmailConsent || newWhatsappConsent;
    const notificationId = needsNewReminder ? randomHex(16) : existing.notificationId;
    const restoreToken = needsNewReminder ? randomHex(32) : existing.restoreToken;
    const unsubscribeToken = needsNewReminder ? randomHex(32) : existing.unsubscribeToken;
    const reminderScheduled = needsNewReminder ? true : existing.reminderScheduled;
    const status = existing?.status === "sending" && !needsNewReminder ? "sending" as const : "active" as const;
    const itemList = [...lines.values()];
    const emailConsentFields = args.emailConsent
      ? { emailConsentedAt: newEmailConsent ? now : existing?.emailConsentedAt ?? now }
      : {
          ...(existing?.emailConsentedAt !== undefined ? { emailConsentedAt: existing.emailConsentedAt } : {}),
          ...(existing?.emailConsent ? { emailOptedOutAt: now } : existing?.emailOptedOutAt !== undefined ? { emailOptedOutAt: existing.emailOptedOutAt } : {}),
        };
    const whatsappConsentFields = args.whatsappConsent
      ? { whatsappConsentedAt: newWhatsappConsent ? now : existing?.whatsappConsentedAt ?? now }
      : {
          ...(existing?.whatsappConsentedAt !== undefined ? { whatsappConsentedAt: existing.whatsappConsentedAt } : {}),
          ...(existing?.whatsappConsent ? { whatsappOptedOutAt: now } : existing?.whatsappOptedOutAt !== undefined ? { whatsappOptedOutAt: existing.whatsappOptedOutAt } : {}),
        };
    const base = {
      items: itemList,
      email,
      whatsapp,
      emailConsent: args.emailConsent,
      whatsappConsent: args.whatsappConsent,
      ...emailConsentFields,
      ...whatsappConsentFields,
      consentCopyVersion,
      status,
      ...(existing ? { orderId: needsNewReminder ? undefined : existing.orderId } : {}),
      unsubscribeToken,
      restoreToken,
      notificationId,
      reminderScheduled,
      lastActivityAt: now,
      expiresAt: now + retentionMs,
      ...(existing && needsNewReminder ? { emailSentAt: undefined, whatsappSentAt: undefined } : {}),
    };

    let cartId: Id<"abandonedCarts">;
    if (existing) {
      await ctx.db.patch(existing._id, base);
      cartId = existing._id;
    } else {
      cartId = await ctx.db.insert("abandonedCarts", { sessionKey: args.sessionKey, ...base });
    }

    if (needsNewReminder) {
      await ctx.scheduler.runAfter(reminderDelayMs, internal.abandonedCartRecovery.processReminder, {
        cartId,
        notificationId,
      });
    }
    return cartId;
  },
});

export const linkOrder = mutation({
  args: { sessionKey: v.string(), orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { sessionKey, orderId }) => {
    const cart = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", sessionKey))
      .first();
    const order = await ctx.db.get(orderId);
    if (!cart || !order || cart.status === "unsubscribed") return null;
    const emailMatches = cart.email && cart.email.toLowerCase() === order.customerEmail.toLowerCase();
    let phoneMatches = false;
    if (cart.whatsapp && order.customerPhone) {
      try {
        phoneMatches = cleanPhone(order.customerPhone) === cart.whatsapp;
      } catch {
        phoneMatches = false;
      }
    }
    if (!emailMatches && !phoneMatches) return null;
    await ctx.db.patch(cart._id, { orderId });
    return null;
  },
});

export const markConvertedForOrder = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const cart = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .first();
    if (cart && cart.status !== "unsubscribed") {
      await ctx.db.patch(cart._id, {
        items: [],
        status: "converted",
        email: undefined,
        whatsapp: undefined,
        reminderScheduled: false,
      });
    }
    return null;
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const cart = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", token))
      .first();
    if (cart) {
      const now = Date.now();
      await ctx.db.patch(cart._id, {
        items: [],
        orderId: undefined,
        email: undefined,
        whatsapp: undefined,
        emailConsent: false,
        whatsappConsent: false,
        emailOptedOutAt: cart.emailConsent ? now : cart.emailOptedOutAt,
        whatsappOptedOutAt: cart.whatsappConsent ? now : cart.whatsappOptedOutAt,
        status: "unsubscribed",
        reminderScheduled: false,
      });
    }
    return null;
  },
});

export const restoreCart = mutation({
  args: { token: v.string() },
  returns: v.union(v.object({ sessionKey: v.string(), items: v.array(itemInputValidator) }), v.null()),
  handler: async (ctx, { token }) => {
    const now = Date.now();
    const cart = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_restore_token", (q) => q.eq("restoreToken", token))
      .first();
    if (!cart || cart.expiresAt <= now || cart.status === "converted" || cart.status === "unsubscribed") return null;
    return { sessionKey: cart.sessionKey, items: cart.items };
  },
});

export const claimReminder = internalMutation({
  args: { cartId: v.id("abandonedCarts"), notificationId: v.string() },
  returns: v.union(
    v.object({
      cartId: v.id("abandonedCarts"),
      notificationId: v.string(),
      email: v.union(v.string(), v.null()),
      whatsapp: v.union(v.string(), v.null()),
      unsubscribeToken: v.string(),
      restoreToken: v.string(),
      items: v.array(v.object({ title: v.string(), slug: v.string() })),
    }),
    v.null(),
  ),
  handler: async (ctx, { cartId, notificationId }) => {
    const cart = await ctx.db.get(cartId);
    if (!cart || cart.notificationId !== notificationId || cart.status !== "active") return null;
    const now = Date.now();
    if (cart.expiresAt <= now) {
      await ctx.db.patch(cartId, { items: [], status: "expired", email: undefined, whatsapp: undefined, reminderScheduled: false });
      return null;
    }
    if (cart.lastActivityAt + reminderDelayMs > now) {
      await ctx.scheduler.runAfter(cart.lastActivityAt + reminderDelayMs - now, internal.abandonedCartRecovery.processReminder, {
        cartId,
        notificationId,
      });
      return null;
    }
    if (cart.orderId) {
      const order = await ctx.db.get(cart.orderId);
      if (order && ["paid", "shipped", "delivered"].includes(order.status)) {
        await ctx.db.patch(cartId, { items: [], status: "converted", email: undefined, whatsapp: undefined, reminderScheduled: false });
        return null;
      }
      if (order?.status === "pending") {
        const payment = await ctx.db
          .query("checkoutPayments")
          .withIndex("by_order", (q) => q.eq("orderId", cart.orderId!))
          .order("desc")
          .first();
        if (payment?.status === "review") {
          await ctx.db.patch(cartId, { items: [], status: "failed", email: undefined, whatsapp: undefined, reminderScheduled: false });
          return null;
        }
        if (payment && ["initializing", "pending"].includes(payment.status) && payment.expiresAt > now) {
          await ctx.scheduler.runAfter(payment.expiresAt - now + 1000, internal.abandonedCartRecovery.processReminder, {
            cartId,
            notificationId,
          });
          return null;
        }
      }
    }

    const items = [];
    for (const item of cart.items.slice(0, 6)) {
      const productId = ctx.db.normalizeId("products", item.productId);
      const product = productId ? await ctx.db.get(productId) : null;
      if (!product?.availableForSale) continue;
      const variants = product.variants ?? [];
      const variantId = item.variantId ?? (variants.length === 1 ? variants[0].id : undefined);
      const variant = variantId ? variants.find((candidate) => candidate.id === variantId) : undefined;
      if (variants.length && !variantId) continue;
      if (variantId && !variant) continue;
      if (variant && !variant.availableForSale) continue;
      const stock = variant?.stockQuantity ?? product.stockQuantity;
      if (stock != null && stock <= 0) continue;
      items.push({ title: product.title, slug: product.slug });
    }
    if (items.length === 0 || (!cart.emailConsent && !cart.whatsappConsent)) {
      await ctx.db.patch(cartId, { status: "failed", email: undefined, whatsapp: undefined, reminderScheduled: false });
      return null;
    }

    const email = cart.emailConsent && cart.email && emailEnabled() ? cart.email : null;
    const whatsapp = cart.whatsappConsent && cart.whatsapp && whatsappEnabled() ? cart.whatsapp : null;
    if (!email && !whatsapp) {
      await ctx.db.patch(cartId, { status: "failed", email: undefined, whatsapp: undefined, reminderScheduled: false });
      return null;
    }
    await ctx.db.patch(cartId, { status: "sending" });
    return {
      cartId,
      notificationId,
      email,
      whatsapp,
      unsubscribeToken: cart.unsubscribeToken,
      restoreToken: cart.restoreToken,
      items,
    };
  },
});

export const finishReminder = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    notificationId: v.string(),
    emailSent: v.boolean(),
    whatsappSent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cart = await ctx.db.get(args.cartId);
    if (!cart || cart.status !== "sending" || cart.notificationId !== args.notificationId) return null;
    const sent = args.emailSent || args.whatsappSent;
    await ctx.db.patch(args.cartId, {
      status: sent ? "sent" : "failed",
      email: undefined,
      whatsapp: undefined,
      emailSentAt: args.emailSent ? Date.now() : cart.emailSentAt,
      whatsappSentAt: args.whatsappSent ? Date.now() : cart.whatsappSentAt,
      reminderScheduled: false,
    });
    return null;
  },
});

export const processReminder = internalAction({
  args: { cartId: v.id("abandonedCarts"), notificationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reminder = await ctx.runMutation(internal.abandonedCartRecovery.claimReminder, args);
    if (!reminder) return null;
    const base = siteUrl();
    if (!base) {
      await ctx.runMutation(internal.abandonedCartRecovery.finishReminder, {
        ...args,
        emailSent: false,
        whatsappSent: false,
      });
      return null;
    }

    const cartUrl = new URL("/cart", base);
    cartUrl.searchParams.set("recover", reminder.restoreToken);
    const unsubscribeUrl = new URL("/cart-reminders/unsubscribe", base);
    unsubscribeUrl.searchParams.set("token", reminder.unsubscribeToken);
    const productList = reminder.items.map((item) => item.title).join(", ");
    let emailSent = false;
    let whatsappSent = false;

    if (reminder.email && env.RESEND_API_KEY && emailFrom()) {
      try {
        const itemsHtml = reminder.items.map((item) => {
          const productUrl = new URL(`/product/${encodeURIComponent(item.slug)}`, base).toString();
          return `<li><a href="${productUrl}">${escapeHtml(item.title)}</a></li>`;
        }).join("");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `cart-recovery/${reminder.notificationId}/email`,
          },
          body: JSON.stringify({
            from: emailFrom(),
            to: [reminder.email],
            subject: "Sepetiniz sizi bekliyor",
            html: `<p>Sepetinizdeki ürünleri tamamlamak için mağazamıza dönebilirsiniz.</p><ul>${itemsHtml}</ul><p><a href="${cartUrl.toString()}">Sepetime dön</a></p><p><a href="${unsubscribeUrl.toString()}">Sepet hatırlatmalarını durdur</a></p>`,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        emailSent = response.ok;
      } catch {
        emailSent = false;
      }
    }

    const sender = whatsappFrom();
    if (reminder.whatsapp && sender && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_CONTENT_SID) {
      try {
        const body = new URLSearchParams({
          To: `whatsapp:${reminder.whatsapp}`,
          From: sender,
          ContentSid: env.TWILIO_WHATSAPP_CONTENT_SID,
          ContentVariables: JSON.stringify({
            "1": productList,
            "2": cartUrl.toString(),
            "3": unsubscribeUrl.toString(),
          }),
        });
        const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
            signal: AbortSignal.timeout(15_000),
          },
        );
        whatsappSent = response.ok;
      } catch {
        whatsappSent = false;
      }
    }

    await ctx.runMutation(internal.abandonedCartRecovery.finishReminder, {
      ...args,
      emailSent,
      whatsappSent,
    });
    return null;
  },
});
