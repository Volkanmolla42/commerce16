import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  restockSignups: { kind: "fixed window", rate: 5, period: 60 * 60 * 1000 },
});

const channelValidator = v.union(v.literal("email"), v.literal("sms"));
const deliveryValidator = v.object({
  subscriptionId: v.id("restockSubscriptions"),
  channel: channelValidator,
  contact: v.string(),
  unsubscribeToken: v.string(),
  notificationId: v.string(),
  productTitle: v.string(),
  productSlug: v.string(),
  variantTitle: v.union(v.string(), v.null()),
});

function cleanContact(channel: "email" | "sms", value: string) {
  if (channel === "email") {
    const email = value.trim().normalize("NFC").toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Geçerli bir e-posta adresi girin.");
    }
    return email;
  }

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

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isProductAvailable(product: { availableForSale: boolean; stockQuantity?: number | null }) {
  return product.availableForSale && (product.stockQuantity == null || product.stockQuantity > 0);
}

function isVariantAvailable(
  product: { availableForSale: boolean; stockQuantity?: number | null },
  variant: { availableForSale: boolean; stockQuantity?: number | null },
) {
  const stockQuantity = variant.stockQuantity ?? product.stockQuantity;
  return product.availableForSale && variant.availableForSale && (stockQuantity == null || stockQuantity > 0);
}

function hasValidSiteUrl() {
  if (!env.RESTOCK_SITE_URL) return false;
  try {
    const url = new URL(env.RESTOCK_SITE_URL);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export const getEnabledChannels = query({
  args: {},
  returns: v.object({ email: v.boolean(), sms: v.boolean() }),
  handler: async () => ({
    email: Boolean(hasValidSiteUrl() && env.RESEND_API_KEY && env.RESTOCK_FROM_EMAIL),
    sms: Boolean(hasValidSiteUrl() && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER),
  }),
});

export const subscribe = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.string(),
    channel: channelValidator,
    contact: v.string(),
    consent: v.boolean(),
  },
  returns: v.object({ status: v.union(v.literal("subscribed"), v.literal("already_subscribed")) }),
  handler: async (ctx, args) => {
    if (!args.consent) throw new Error("Bildirim almak için onay vermeniz gerekiyor.");
    if (!hasValidSiteUrl() || (args.channel === "email" && (!env.RESEND_API_KEY || !env.RESTOCK_FROM_EMAIL)) ||
      (args.channel === "sms" && (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER))) {
      throw new Error("Bu bildirim kanalı şu anda etkin değil.");
    }
    const contact = cleanContact(args.channel, args.contact);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Ürün bulunamadı.");
    if (!product.availableForSale) throw new Error("Bu ürün şu anda satışta değil.");

    if ((product.variants?.length ?? 0) > 0) {
      const variant = product.variants?.find((candidate) => candidate.id === args.variantId);
      if (!variant) throw new Error("Önce bir ürün seçeneği belirleyin.");
      if (isVariantAvailable(product, variant)) throw new Error("Bu seçenek şu anda stokta.");
    } else {
      if (args.variantId !== "") throw new Error("Ürün seçeneği geçersiz.");
      if (isProductAvailable(product)) throw new Error("Bu ürün şu anda stokta.");
    }

    const existing = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_product_variant_contact", (q) =>
        q.eq("productId", args.productId).eq("variantId", args.variantId).eq("contact", contact),
      )
      .first();
    if (existing?.status === "active" || existing?.status === "sending") {
      return { status: "already_subscribed" as const };
    }

    await rateLimiter.limit(ctx, "restockSignups", { key: await hash(contact), throws: true });
    const now = Date.now();
    const unsubscribeToken = randomHex(32);
    const notificationId = randomHex(16);
    if (existing) {
      await ctx.db.patch(existing._id, {
        channel: args.channel,
        contact,
        status: "active",
        consentedAt: now,
        unsubscribeToken,
        notificationId,
        sentAt: undefined,
      });
    } else {
      await ctx.db.insert("restockSubscriptions", {
        productId: args.productId,
        variantId: args.variantId,
        channel: args.channel,
        contact,
        status: "active",
        consentedAt: now,
        unsubscribeToken,
        notificationId,
      });
    }
    return { status: "subscribed" as const };
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ unsubscribed: v.boolean() }),
  handler: async (ctx, { token }) => {
    if (token.length !== 64 || !/^[a-f0-9]+$/.test(token)) return { unsubscribed: false };
    const subscription = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", token))
      .first();
    if (!subscription) return { unsubscribed: false };
    await ctx.db.patch(subscription._id, {
      status: subscription.status === "active" || subscription.status === "sending"
        ? "unsubscribed"
        : subscription.status,
      contact: undefined,
    });
    return { unsubscribed: true };
  },
});

export const getActiveBatch = internalQuery({
  args: {
    productId: v.id("products"),
    variantId: v.string(),
    channel: channelValidator,
  },
  returns: v.array(deliveryValidator),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return [];

    let variantTitle: string | null = null;
    if (product.variants?.length) {
      const variant = product.variants.find((candidate) => candidate.id === args.variantId);
      if (!variant || !isVariantAvailable(product, variant)) return [];
      variantTitle = variant.selectedOptions.length ? variant.title : null;
    } else if (args.variantId !== "" || !isProductAvailable(product)) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_product_variant_channel_status", (q) =>
        q.eq("productId", args.productId)
          .eq("variantId", args.variantId)
          .eq("channel", args.channel)
          .eq("status", "active"),
      )
      .take(50);
    return subscriptions.flatMap((subscription) => subscription.contact ? [{
      subscriptionId: subscription._id,
      channel: subscription.channel,
      contact: subscription.contact,
      unsubscribeToken: subscription.unsubscribeToken,
      notificationId: subscription.notificationId,
      productTitle: product.title,
      productSlug: product.slug,
      variantTitle,
    }] : []);
  },
});

export const claim = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.boolean(),
  handler: async (ctx, { subscriptionId }) => {
    const subscription = await ctx.db.get(subscriptionId);
    if (!subscription || subscription.status !== "active") return false;
    const product = await ctx.db.get(subscription.productId);
    if (!product) return false;
    if (product.variants?.length) {
      const variant = product.variants.find((candidate) => candidate.id === subscription.variantId);
      if (!variant || !isVariantAvailable(product, variant)) return false;
    } else if (subscription.variantId !== "" || !isProductAvailable(product)) {
      return false;
    }
    await ctx.db.patch(subscriptionId, { status: "sending" });
    return true;
  },
});

export const finish = internalMutation({
  args: {
    subscriptionId: v.id("restockSubscriptions"),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (subscription?.status === "sending") {
      await ctx.db.patch(args.subscriptionId, {
        status: args.status,
        sentAt: args.status === "sent" ? Date.now() : undefined,
        contact: args.status === "sent" ? undefined : subscription.contact,
      });
    }
    return null;
  },
});

export const deleteForProduct = internalMutation({
  args: { productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, { productId }) => {
    const batch = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .take(100);
    for (const subscription of batch) await ctx.db.delete(subscription._id);
    if (batch.length === 100) {
      await ctx.scheduler.runAfter(0, internal.restockNotifications.deleteForProduct, { productId });
    }
    return null;
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

export const processRestock = internalAction({
  args: { productId: v.id("products"), variantId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const configuredSite = env.RESTOCK_SITE_URL;
    let siteUrl: URL | null = null;
    if (configuredSite) {
      try {
        const parsed = new URL(configuredSite);
        if (parsed.protocol === "https:" || parsed.hostname === "localhost") siteUrl = parsed;
      } catch {
        siteUrl = null;
      }
    }

    const readyChannels = [
      env.RESEND_API_KEY && env.RESTOCK_FROM_EMAIL && siteUrl ? "email" : null,
      env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && siteUrl ? "sms" : null,
    ].filter((channel): channel is "email" | "sms" => channel !== null);
    if (readyChannels.length === 0) return null;

    for (const channel of readyChannels) {
      const batch = await ctx.runQuery(internal.restockNotifications.getActiveBatch, { ...args, channel });
      for (const subscription of batch) {
        const claimed = await ctx.runMutation(internal.restockNotifications.claim, {
          subscriptionId: subscription.subscriptionId,
        });
        if (!claimed) continue;

        const productUrl = new URL(`/product/${encodeURIComponent(subscription.productSlug)}`, siteUrl!).toString();
        const unsubscribeUrl = new URL("/restock/unsubscribe", siteUrl!);
        unsubscribeUrl.searchParams.set("token", subscription.unsubscribeToken);
        const title = subscription.variantTitle
          ? `${subscription.productTitle} — ${subscription.variantTitle}`
          : subscription.productTitle;
        let succeeded = false;
        try {
          if (channel === "email") {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY!}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `restock/${subscription.notificationId}`,
              },
              body: JSON.stringify({
                from: env.RESTOCK_FROM_EMAIL!,
                to: [subscription.contact],
                subject: `${title} yeniden stokta`,
                html: `<p>İstediğiniz ürün yeniden stokta.</p><p><a href="${productUrl}">${escapeHtml(title)} ürününü görüntüleyin</a></p><p><a href="${unsubscribeUrl.toString()}">Stok bildirimini iptal et</a></p>`,
              }),
              signal: AbortSignal.timeout(15_000),
            });
            succeeded = response.ok;
          } else {
            const body = new URLSearchParams({
              To: subscription.contact,
              From: env.TWILIO_FROM_NUMBER!,
              Body: `${title} yeniden stokta: ${productUrl} Bildirimi iptal et: ${unsubscribeUrl.toString()}`,
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
            succeeded = response.ok;
          }
        } catch {
          succeeded = false;
        }

        await ctx.runMutation(internal.restockNotifications.finish, {
          subscriptionId: subscription.subscriptionId,
          status: succeeded ? "sent" : "failed",
        });
      }

      if (batch.length === 50) {
        await ctx.scheduler.runAfter(0, internal.restockNotifications.processRestock, args);
      }
    }
    return null;
  },
});
