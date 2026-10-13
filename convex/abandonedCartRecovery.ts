import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdminApiSecret } from "./adminAuth";
import { getImagesForVariant } from "../lib/catalog/product-images";

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

function siteUrl() {
  const value = env.CART_RECOVERY_SITE_URL || "http://localhost:3000";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost" ? parsed : new URL("http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

function formatTRY(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

function emailFrom() {
  return env.CART_RECOVERY_FROM_EMAIL;
}

function emailEnabled() {
  return Boolean(siteUrl() && env.RESEND_API_KEY && emailFrom());
}

import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

export const getAvailability = query({
  args: {},
  returns: v.object({ email: v.boolean() }),
  handler: async () => ({ email: emailEnabled() }),
});

export const capture = mutation({
  args: {
    sessionKey: v.string(),
    email: v.optional(v.string()),
    emailConsent: v.boolean(),
    items: v.array(itemInputValidator),
  },
  returns: v.union(v.id("abandonedCarts"), v.null()),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{32,64}$/i.test(args.sessionKey)) throw new Error("Sepet oturumu geçersiz.");
    if (args.items.length > 100) throw new Error("Sepet en fazla 100 ürün içerebilir.");
    if (args.emailConsent && !emailEnabled()) throw new Error("E-posta hatırlatması şu anda etkin değil.");

    const email = args.emailConsent ? cleanEmail(args.email ?? "") : undefined;
    const existing = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (!args.emailConsent) {
      if (!existing) return null;
      const now = Date.now();
      await ctx.db.patch(existing._id, {
        items: [],
        orderId: undefined,
        email: undefined,
        emailConsent: false,
        emailOptedOutAt: existing.emailConsent ? now : existing.emailOptedOutAt,
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
    if (newEmailConsent && email) {
      await rateLimiter.limit(ctx, "cartRecoveryConsent", { key: await hash(`email:${email}`), throws: true });
    }

    const now = Date.now();
    const needsNewReminder = !existing ||
      existing.status === "sent" || existing.status === "converted" || existing.status === "unsubscribed" ||
      existing.status === "failed" || existing.status === "expired" || newEmailConsent;
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
    const base = {
      items: itemList,
      email,
      emailConsent: args.emailConsent,
      ...emailConsentFields,
      consentCopyVersion,
      status,
      ...(existing ? { orderId: needsNewReminder ? undefined : existing.orderId } : {}),
      unsubscribeToken,
      restoreToken,
      notificationId,
      reminderScheduled,
      lastActivityAt: now,
      expiresAt: now + retentionMs,
      ...(existing && needsNewReminder ? { emailSentAt: undefined } : {}),
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
    if (!emailMatches) return null;
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
        emailConsent: false,
        emailOptedOutAt: cart.emailConsent ? now : cart.emailOptedOutAt,
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
  args: { cartId: v.id("abandonedCarts"), notificationId: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(
    v.object({
      cartId: v.id("abandonedCarts"),
      notificationId: v.string(),
      email: v.string(),
      unsubscribeToken: v.string(),
      restoreToken: v.string(),
      storeName: v.string(),
      items: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          price: v.string(),
          quantity: v.number(),
          variantTitle: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
        })
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, { cartId, notificationId, force }) => {
    const cart = await ctx.db.get(cartId);
    if (!cart || cart.notificationId !== notificationId || (cart.status !== "active" && !force)) return null;
    const now = Date.now();
    if (cart.expiresAt <= now && !force) {
      await ctx.db.patch(cartId, { items: [], status: "expired", email: undefined, reminderScheduled: false });
      return null;
    }
    if (!force && cart.lastActivityAt + reminderDelayMs > now) {
      await ctx.scheduler.runAfter(cart.lastActivityAt + reminderDelayMs - now, internal.abandonedCartRecovery.processReminder, {
        cartId,
        notificationId,
      });
      return null;
    }
    if (cart.orderId) {
      const order = await ctx.db.get(cart.orderId);
      if (order && order.status !== "cancelled") {
        await ctx.db.patch(cartId, { items: [], status: "converted", email: undefined, reminderScheduled: false });
        return null;
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

      const firstImage = product.images?.[0];
      const imageUrl = firstImage ? await ctx.storage.getUrl(firstImage.storageId) : null;
      const price = variant?.price ?? product.variants?.[0]?.price ?? "0";
      const variantTitle = variant?.title && variant.title !== "Default Title" ? variant.title : undefined;

      items.push({
        title: product.title,
        slug: product.slug,
        price,
        quantity: item.quantity,
        variantTitle,
        imageUrl: imageUrl ?? undefined,
      });
    }
    if (items.length === 0 || !cart.emailConsent) {
      await ctx.db.patch(cartId, { status: "failed", email: undefined, reminderScheduled: false });
      return null;
    }

    const email = cart.emailConsent && cart.email && emailEnabled() ? cart.email : null;
    if (!email) {
      await ctx.db.patch(cartId, { status: "failed", email: undefined, reminderScheduled: false });
      return null;
    }

    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .first();
    const storeName = settings?.storeName?.trim() || "Mağazamız";

    await ctx.db.patch(cartId, { status: "sending" });
    return {
      cartId,
      notificationId,
      email,
      unsubscribeToken: cart.unsubscribeToken,
      restoreToken: cart.restoreToken,
      storeName,
      items,
    };
  },
});

export const finishReminder = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    notificationId: v.string(),
    emailSent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cart = await ctx.db.get(args.cartId);
    if (!cart || cart.status !== "sending" || cart.notificationId !== args.notificationId) return null;
    await ctx.db.patch(args.cartId, {
      status: args.emailSent ? "sent" : "failed",
      email: undefined,
      emailSentAt: args.emailSent ? Date.now() : cart.emailSentAt,
      reminderScheduled: false,
    });
    return null;
  },
});

export const processReminder = internalAction({
  args: { cartId: v.id("abandonedCarts"), notificationId: v.string(), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reminder = await ctx.runMutation(internal.abandonedCartRecovery.claimReminder, args);
    if (!reminder) return null;
    const base = siteUrl();
    if (!base) {
      await ctx.runMutation(internal.abandonedCartRecovery.finishReminder, {
        cartId: args.cartId,
        notificationId: args.notificationId,
        emailSent: false,
      });
      return null;
    }

    const cartUrl = new URL("/cart", base);
    cartUrl.searchParams.set("recover", reminder.restoreToken);
    const unsubscribeUrl = new URL("/cart-reminders/unsubscribe", base);
    unsubscribeUrl.searchParams.set("token", reminder.unsubscribeToken);
    let emailSent = false;

    if (reminder.email && env.RESEND_API_KEY && emailFrom()) {
      try {
        const storeName = reminder.storeName;
        const subject = `Sepetinizde ürünler kaldı! Alışverişinizi tamamlayın | ${storeName}`;

        const totalKurus = reminder.items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0);
        const totalText = formatTRY(totalKurus / 100);

        // Plain text
        const textLines = reminder.items.map(
          (i) => `• ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""} - ${i.quantity} adet × ${formatTRY(i.price)}`
        );
        const text = [
          `${storeName.toUpperCase()} — SEPETİNİZ SİZİ BEKLİYOR`,
          `----------------------------------------`,
          `Merhaba,`,
          ``,
          `Sepetinizde bıraktığınız ürünler tükenmeden alışverişinizi kolayca tamamlayabilirsiniz.`,
          ``,
          `Sepetinizdeki Ürünler:`,
          ...textLines,
          ``,
          `Tahmini Toplam: ${totalText}`,
          ``,
          `Sepetinizi geri yüklemek ve alışverişinizi tamamlamak için tıklayın:`,
          cartUrl.toString(),
          ``,
          `----------------------------------------`,
          `Sepet hatırlatma e-postalarını almak istemiyorsanız:`,
          unsubscribeUrl.toString(),
          `----------------------------------------`,
          `© ${storeName}`,
        ].join("\n");

        // HTML Ürün Satırları
        const itemRowsHtml = reminder.items.map((item) => {
          const itemTotal = Number(item.price) * item.quantity;
          const imageHtml = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;margin-right:12px;" />`
            : `<div style="width:56px;height:56px;border-radius:8px;background-color:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px;margin-right:12px;text-align:center;line-height:56px;">Görsel Yok</div>`;

          return `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                  <tr>
                    <td style="width:68px;vertical-align:middle;">
                      ${imageHtml}
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:14px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</div>
                      ${item.variantTitle ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(item.variantTitle)}</div>` : ""}
                      <div style="font-size:13px;color:#4b5563;margin-top:2px;">${item.quantity} adet × ${escapeHtml(formatTRY(item.price))}</div>
                    </td>
                    <td style="vertical-align:middle;text-align:right;font-size:14px;font-weight:600;color:#111827;">
                      ${escapeHtml(formatTRY(itemTotal))}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        }).join("");

        const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;line-height:1.5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Üst Bar / Marka -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.03em;">${escapeHtml(storeName)}</span>
            </td>
          </tr>

          <!-- Karşılama & Başlık -->
          <tr>
            <td style="padding:32px 32px 16px 32px;text-align:center;">
              <div style="display:inline-block;padding:6px 14px;background-color:#eff6ff;color:#1d4ed8;border-radius:9999px;font-size:13px;font-weight:700;margin-bottom:16px;border:1px solid #bfdbfe;">
                🛒 SEPETİNİZ SİZİ BEKLİYOR
              </div>
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.02em;">
                Bir Şeyler Unutmuş Olabilirsiniz!
              </h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                Sepetinizde seçtiğiniz harika ürünler duruyor. Stoklar tükenmeden siparişinizi tek tıkla tamamlayabilirsiniz.
              </p>
            </td>
          </tr>

          <!-- Ürün Listesi Tablosu -->
          <tr>
            <td style="padding:10px 32px 20px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;padding:16px 20px;">
                <tr>
                  <td>
                    <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
                      Sepetinizdeki Ürünler
                    </div>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${itemRowsHtml}
                    </table>
                    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="font-size:14px;font-weight:600;color:#374151;">Tahmini Toplam</td>
                          <td style="text-align:right;font-size:16px;font-weight:800;color:#111827;">${escapeHtml(totalText)}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Butonu -->
          <tr>
            <td style="padding:10px 32px 32px 32px;text-align:center;">
              <a href="${escapeHtml(cartUrl.toString())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:100%;max-width:320px;padding:14px 28px;background-color:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:center;">
                Sepetime Dön ve Siparişi Tamamla &rarr;
              </a>
            </td>
          </tr>

          <!-- Alt Bilgi / Unsubscribe -->
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;font-size:12px;color:#9ca3af;">
              <p style="margin:0 0 8px 0;">
                Bu e-posta, <strong>${escapeHtml(storeName)}</strong> mağazasında alışveriş sepeti hatırlatması onayınız bulunduğu için gönderilmiştir.
              </p>
              <p style="margin:0;">
                Artık sepet hatırlatma e-postaları almak istemiyorsanız <a href="${escapeHtml(unsubscribeUrl.toString())}" target="_blank" rel="noopener noreferrer" style="color:#6b7280;text-decoration:underline;">buraya tıklayarak abonelikten çıkabilirsiniz</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        const from = formatSender(storeName, emailFrom());
        const result = await sendResendEmail({
          to: reminder.email,
          subject,
          text,
          html,
          from,
          idempotencyKey: `cart-recovery/${reminder.notificationId}/email`,
        });

        await ctx.runMutation(internal.emailTemplates.recordEmailLog, {
          templateKey: "abandoned_cart_recovery",
          recipient: reminder.email,
          subject,
          status: result.ok ? "sent" : "failed",
          error: result.error,
          metadata: {
            cartId: args.cartId,
            notificationId: args.notificationId,
            itemCount: reminder.items.length,
          },
        });

        emailSent = result.ok;
      } catch (err) {
        console.error("Abandoned cart email send failed:", err);
        emailSent = false;
      }
    }

    await ctx.runMutation(internal.abandonedCartRecovery.finishReminder, {
      cartId: args.cartId,
      notificationId: args.notificationId,
      emailSent,
    });
    return null;
  },
});

export const triggerReminderAdmin = mutation({
  args: {
    adminSecret: v.string(),
    cartId: v.id("abandonedCarts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const cart = await ctx.db.get(args.cartId);
    if (!cart) throw new Error("Sepet bulunamadı.");
    await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.processReminder, {
      cartId: args.cartId,
      notificationId: cart.notificationId,
      force: true,
    });
    return null;
  },
});

export const listAllAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("abandonedCarts"),
      _creationTime: v.number(),
      sessionKey: v.string(),
      email: v.optional(v.string()),
      emailConsent: v.boolean(),
      emailConsentedAt: v.optional(v.number()),
      status: v.string(),
      orderId: v.optional(v.id("orders")),
      restoreToken: v.string(),
      reminderScheduled: v.boolean(),
      lastActivityAt: v.number(),
      expiresAt: v.number(),
      emailSentAt: v.optional(v.number()),
      itemCount: v.number(),
      estimatedTotal: v.string(),
      items: v.array(
        v.object({
          productId: v.string(),
          variantId: v.optional(v.string()),
          quantity: v.number(),
          title: v.string(),
          variantTitle: v.optional(v.string()),
          price: v.string(),
          image: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const carts = await ctx.db.query("abandonedCarts").order("desc").take(100);
    const results = [];
    for (const cart of carts) {
      let total = 0;
      let count = 0;
      const items = [];
      for (const item of cart.items) {
        count += item.quantity;
        const productId = ctx.db.normalizeId("products", item.productId);
        const product = productId ? await ctx.db.get(productId) : null;
        const variants = product?.variants ?? [];
        const variant = item.variantId ? variants.find((v) => v.id === item.variantId) : undefined;
        const priceStr = variant?.price ?? "0.00";
        const priceNum = parseFloat(priceStr) || 0;
        total += priceNum * item.quantity;
        const imageRecord = product ? getImagesForVariant(product.images, variant?.selectedOptions ?? [])[0] : undefined;
        const image = imageRecord ? await ctx.storage.getUrl(imageRecord.storageId) : null;
        items.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          title: product?.title ?? "Silinmiş ürün",
          variantTitle: variant?.title,
          price: priceStr,
          image: image ?? undefined,
        });
      }
      results.push({
        _id: cart._id,
        _creationTime: cart._creationTime,
        sessionKey: cart.sessionKey,
        email: cart.email,
        emailConsent: cart.emailConsent,
        emailConsentedAt: cart.emailConsentedAt,
        status: cart.status,
        orderId: cart.orderId,
        restoreToken: cart.restoreToken,
        reminderScheduled: cart.reminderScheduled,
        lastActivityAt: cart.lastActivityAt,
        expiresAt: cart.expiresAt,
        emailSentAt: cart.emailSentAt,
        itemCount: count,
        estimatedTotal: total.toFixed(2),
        items,
      });
    }
    return results;
  },
});

export const deleteAdmin = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("abandonedCarts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const cart = await ctx.db.get(args.id);
    if (cart) {
      await ctx.db.delete(args.id);
    }
    return null;
  },
});

export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const cart of expired) {
      await ctx.db.delete(cart._id);
    }
    if (expired.length === 100) {
      await ctx.scheduler.runAfter(0, internal.abandonedCartRecovery.purgeExpired, {});
    }
    return null;
  },
});

