import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, mutation, query } from "./_generated/server";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  restockSubscribe: { kind: "fixed window", rate: 10, period: 60 * 60 * 1000 },
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
    throw new Error("Lütfen geçerli bir e-posta adresi girin.");
  }
  return email;
}

import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

function formatTRY(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

// 1. Müşterinin stok bildirimi kaydı oluşturması
export const subscribe = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    email: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    alreadySubscribed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const email = cleanEmail(args.email);
    const emailHash = await hash(`restock:${email}`);
    await rateLimiter.limit(ctx, "restockSubscribe", { key: emailHash, throws: true });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Ürün bulunamadı.");

    // Varyant kontrolü
    if (args.variantId) {
      const variant = product.variants?.find((v) => v.id === args.variantId);
      if (!variant) throw new Error("Seçilen ürün varyantı bulunamadı.");
      if (variant.availableForSale && (variant.stockQuantity === undefined || variant.stockQuantity > 0)) {
        return {
          ok: true,
          message: "Bu ürün seçeneği şu anda zaten stokta bulunuyor.",
          alreadySubscribed: false,
        };
      }
    } else {
      if (product.availableForSale) {
        const hasStock = product.variants?.some(
          (v) => v.availableForSale && (v.stockQuantity === undefined || v.stockQuantity > 0)
        );
        if (hasStock) {
          return {
            ok: true,
            message: "Bu ürün şu anda zaten stokta bulunuyor.",
            alreadySubscribed: false,
          };
        }
      }
    }

    // Zaten pending kaydı var mı kontrolü (idempotent)
    const existing = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_email_and_product", (q) => q.eq("email", email).eq("productId", args.productId))
      .filter((q) =>
        q.and(
          q.eq(q.field("variantId"), args.variantId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existing) {
      return {
        ok: true,
        message: "Bu ürün için stok bildirim kaydınız zaten bulunmaktadır. Ürün stoğa girdiğinde bilgilendirileceksiniz.",
        alreadySubscribed: true,
      };
    }

    const unsubscribeToken = randomHex(32);
    await ctx.db.insert("restockSubscriptions", {
      email,
      productId: args.productId,
      variantId: args.variantId,
      status: "pending",
      unsubscribeToken,
      createdAt: Date.now(),
    });

    return {
      ok: true,
      message: "Harika! Ürün tekrar stoğa girdiğinde e-posta ile bilgilendirileceksiniz.",
      alreadySubscribed: false,
    };
  },
});

// 2. Token ile abonelik sorgulama
export const getSubscriptionByToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      id: v.id("restockSubscriptions"),
      productTitle: v.string(),
      productSlug: v.string(),
      email: v.string(),
      status: v.union(v.literal("pending"), v.literal("notified"), v.literal("cancelled")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
    if (!sub) return null;
    const product = await ctx.db.get(sub.productId);
    return {
      id: sub._id,
      productTitle: product?.title ?? "Ürün",
      productSlug: product?.slug ?? "",
      email: sub.email,
      status: sub.status,
    };
  },
});

// 3. Abonelikten çıkma (Unsubscribe)
export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
    if (!sub) {
      return { ok: false, message: "Abonelik kaydı bulunamadı veya daha önce iptal edilmiş." };
    }
    if (sub.status === "cancelled") {
      return { ok: true, message: "Aboneliğiniz zaten iptal edilmiştir." };
    }
    await ctx.db.patch(sub._id, { status: "cancelled" });
    return { ok: true, message: "Stok bildirim aboneliğiniz başarıyla iptal edildi." };
  },
});

// 4. Belirli bir ürün veya varyantın stok yenilenmesini kontrol edip bildirimleri zamanlama
export const triggerRestockCheck = internalMutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.availableForSale) return null;

    // Bekleyen aboneleri topla
    let subs = await ctx.db
      .query("restockSubscriptions")
      .withIndex("by_product_and_variant", (q) => q.eq("productId", args.productId).eq("variantId", args.variantId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(100);

    // Eğer genel ürün seviyesinde stok geldiyse varyantsız bekleyenleri de ekle
    if (args.variantId) {
      const genericSubs = await ctx.db
        .query("restockSubscriptions")
        .withIndex("by_product_and_variant", (q) => q.eq("productId", args.productId).eq("variantId", undefined))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .take(100);
      subs = [...subs, ...genericSubs];
    }

    if (subs.length === 0) return null;

    // Her abone için bildirim gönderme eylemini tetikle
    for (const sub of subs) {
      await ctx.scheduler.runAfter(0, internal.restock.sendRestockEmailAction, {
        subscriptionId: sub._id,
      });
    }
    return null;
  },
});

// 5. Tek bir abone için e-posta gönderen internal action
export const sendRestockEmailAction = internalAction({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runMutation(internal.restock.claimForNotification, {
      subscriptionId: args.subscriptionId,
    });
    if (!data) return null;

    const { sub, product, variant, storeName, siteUrl } = data;
    const from = formatSender(storeName, process.env.RESTOCK_FROM_EMAIL);
    const productUrl = `${siteUrl}/product/${product.slug}`;
    const unsubscribeUrl = `${siteUrl}/restock/unsubscribe?token=${sub.unsubscribeToken}`;
    const variantTitle = variant?.title && variant.title !== "Default Title" ? variant.title : null;
    const priceText = formatTRY(variant?.price ?? product.price);
    const imageUrl = product.imageUrl ?? null;

    const subject = `Müjde! ${product.title} Tekrar Stokta! | ${storeName}`;

    // Plain text
    const text = [
      `${storeName.toUpperCase()} — TEKRAR STOKTA!`,
      `----------------------------------------`,
      `Merhaba,`,
      ``,
      `Beklediğiniz ürün tekrar stoklarımıza girdi!`,
      ``,
      `Ürün: ${product.title}`,
      ...(variantTitle ? [`Seçenek: ${variantTitle}`] : []),
      `Fiyat: ${priceText}`,
      ``,
      `Hemen incelemek ve tükenmeden satın almak için tıklayın:`,
      productUrl,
      ``,
      `----------------------------------------`,
      `Bu ürün için artık bildirim almak istemiyorsanız:`,
      unsubscribeUrl,
      `----------------------------------------`,
      `© ${storeName}`,
    ].join("\n");

    // Modern HTML Şablonu
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title)}" style="max-width:180px;height:auto;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px;display:block;" />`
      : "";

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

          <!-- Karşılama & Müjde -->
          <tr>
            <td style="padding:32px 32px 20px 32px;text-align:center;">
              <div style="display:inline-block;padding:6px 14px;background-color:#ecfdf5;color:#047857;border-radius:9999px;font-size:13px;font-weight:700;margin-bottom:16px;border:1px solid #a7f3d0;">
                ✨ TEKRAR STOKTA!
              </div>
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.02em;">
                Beklediğiniz Ürün Geldi!
              </h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                Haber vermemizi istediğiniz <strong>${escapeHtml(product.title)}</strong> ürünümüz yeniden stoklarımıza eklendi. Yoğun talep nedeniyle hızla tükenebilir!
              </p>
            </td>
          </tr>

          <!-- Ürün Kartı -->
          <tr>
            <td style="padding:10px 32px 24px 32px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;padding:24px;text-align:center;">
                <tr>
                  <td align="center">
                    ${imageHtml}
                    <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:6px;">
                      ${escapeHtml(product.title)}
                    </div>
                    ${variantTitle ? `<div style="font-size:13px;color:#6b7280;margin-bottom:8px;">Seçenek: <strong>${escapeHtml(variantTitle)}</strong></div>` : ""}
                    <div style="font-size:20px;font-weight:800;color:#16a34a;margin-bottom:20px;">
                      ${escapeHtml(priceText)}
                    </div>
                    <div>
                      <a href="${escapeHtml(productUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        Hemen İncele & Satın Al &rarr;
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alt Bilgi / Unsubscribe -->
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;font-size:12px;color:#9ca3af;">
              <p style="margin:0 0 8px 0;">
                Bu e-posta, <strong>${escapeHtml(storeName)}</strong> mağazasında stok bildirim talebinde bulunduğunuz için gönderilmiştir.
              </p>
              <p style="margin:0;">
                Artık bu ürün için bildirim almak istemiyorsanız <a href="${escapeHtml(unsubscribeUrl)}" target="_blank" rel="noopener noreferrer" style="color:#6b7280;text-decoration:underline;">buraya tıklayarak bildirim aboneliğinizi sonlandırabilirsiniz</a>.
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

    const result = await sendResendEmail({
      to: sub.email,
      subject,
      text,
      html,
      from,
      idempotencyKey: `restock/${sub._id}`,
    });

    await ctx.runMutation(internal.emailTemplates.recordEmailLog, {
      templateKey: "restock_notification",
      recipient: sub.email,
      subject,
      status: result.ok ? "sent" : "failed",
      error: result.error,
      metadata: {
        subscriptionId: sub._id,
        productId: product._id,
        productTitle: product.title,
      },
    });

    if (result.ok) {
      await ctx.runMutation(internal.restock.markNotified, {
        subscriptionId: sub._id,
      });
    }

    return null;
  },
});

// 6. Bildirim için veriyi topla ve claim et
export const claimForNotification = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.union(
    v.object({
      sub: v.object({
        _id: v.id("restockSubscriptions"),
        email: v.string(),
        unsubscribeToken: v.string(),
      }),
      product: v.object({
        _id: v.id("products"),
        title: v.string(),
        slug: v.string(),
        price: v.string(),
        imageUrl: v.optional(v.string()),
      }),
      variant: v.union(
        v.object({
          id: v.string(),
          title: v.string(),
          price: v.string(),
        }),
        v.null()
      ),
      storeName: v.string(),
      siteUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.status !== "pending") return null;

    const product = await ctx.db.get(sub.productId);
    if (!product) return null;

    const variant = sub.variantId
      ? product.variants?.find((v) => v.id === sub.variantId) ?? null
      : null;

    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .first();

    const storeName = settings?.storeName?.trim() || "Mağazamız";
    const siteUrl = env.CART_RECOVERY_SITE_URL || "http://localhost:3000";

    const firstImage = product.images?.[0];
    const imageUrl = firstImage ? await ctx.storage.getUrl(firstImage.storageId) : null;
    const basePrice = product.variants?.[0]?.price ?? "0";

    return {
      sub: {
        _id: sub._id,
        email: sub.email,
        unsubscribeToken: sub.unsubscribeToken,
      },
      product: {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        price: basePrice,
        imageUrl: imageUrl ?? undefined,
      },
      variant: variant ? { id: variant.id, title: variant.title, price: variant.price } : null,
      storeName,
      siteUrl,
    };
  },
});

// 7. Bildirim tamamlandı olarak işaretle
export const markNotified = internalMutation({
  args: { subscriptionId: v.id("restockSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (sub && sub.status === "pending") {
      await ctx.db.patch(sub._id, {
        status: "notified",
        notifiedAt: Date.now(),
      });
    }
    return null;
  },
});
