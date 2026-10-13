import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";

export const eventValidator = v.union(
  v.literal("payment_confirmation"),
  v.literal("order_shipped"),
  v.literal("order_cancelled"),
  v.literal("order_delivered"),
  v.literal("admin_new_order")
);
const eventRecordValidator = schema.doc("orderEmailEvents");

const emailItemValidator = v.object({
  title: v.string(),
  quantity: v.number(),
  price: v.string(),
  image: v.union(v.string(), v.null()),
  sku: v.union(v.string(), v.null()),
});

const emailPayloadValidator = v.object({
  orderId: v.id("orders"),
  event: eventValidator,
  customerEmail: v.string(),
  customerName: v.string(),
  customerPhone: v.union(v.string(), v.null()),
  shippingAddress: v.union(v.string(), v.null()),
  total: v.string(),
  couponCode: v.union(v.string(), v.null()),
  couponDiscountKurus: v.union(v.number(), v.null()),
  createdAt: v.number(),
  shippedAt: v.union(v.number(), v.null()),
  carrier: v.union(v.string(), v.null()),
  trackingNumber: v.union(v.string(), v.null()),
  trackingUrl: v.union(v.string(), v.null()),
  itemCount: v.number(),
  items: v.array(emailItemValidator),
  storeName: v.string(),
  storeEmail: v.union(v.string(), v.null()),
  storePhone: v.union(v.string(), v.null()),
});

export type EmailEvent = "payment_confirmation" | "order_shipped" | "order_cancelled" | "order_delivered" | "admin_new_order";
type EmailItem = {
  title: string;
  quantity: number;
  price: string;
  image: string | null;
  sku: string | null;
};
type EmailPayload = {
  orderId: Id<"orders">;
  event: EmailEvent;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  shippingAddress: string | null;
  total: string;
  couponCode: string | null;
  couponDiscountKurus: number | null;
  createdAt: number;
  shippedAt: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  itemCount: number;
  items: EmailItem[];
  storeName: string;
  storeEmail: string | null;
  storePhone: string | null;
};

export function resolveCarrierTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  if (!trackingNumber?.trim()) return null;
  const num = encodeURIComponent(trackingNumber.trim());
  const name = carrier?.trim().toLowerCase() || "";

  if (name.includes("yurtiçi") || name.includes("yurtici")) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${num}`;
  }
  if (name.includes("aras")) {
    return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${num}`;
  }
  if (name.includes("mng")) {
    return `https://service.mngkargo.com.tr/iactive/popup/kargotakip.asp?k=${num}`;
  }
  if (name.includes("ptt")) {
    return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${num}`;
  }
  if (name.includes("sürat") || name.includes("surat")) {
    return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${num}`;
  }
  if (name.includes("hepsijet") || name.includes("hepsi jet")) {
    return `https://hepsijet.com/gonderi-takibi/${num}`;
  }
  if (name.includes("trendyol")) {
    return `https://kargotakip.trendyol.com/?trackingNumber=${num}`;
  }
  if (name.includes("kolay gelsin") || name.includes("kolaygelsin")) {
    return `https://esube.kolaygelsin.com/shipments?trackingId=${num}`;
  }
  return null;
}

export const getOrderEmailPayload = internalQuery({
  args: { orderId: v.id("orders"), event: eventValidator },
  returns: v.union(emailPayloadValidator, v.null()),
  handler: async (ctx, { orderId, event }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    // Durum kontrolü: Her bildirim kendi geçerli sipariş statüsünde gönderilir
    if (event === "payment_confirmation" && order.status === "pending") return null;
    if (event === "order_shipped" && order.status !== "shipped" && order.status !== "delivered") return null;
    if (event === "order_cancelled" && order.status !== "cancelled") return null;
    if (event === "order_delivered" && order.status !== "delivered") return null;

    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();

    const storeName = settings?.storeName?.trim() || "Mağaza";
    const storeEmail = settings?.email?.trim() || null;
    const storePhone = settings?.phone?.trim() || null;

    const trackingUrl = order.trackingUrl?.trim() || resolveCarrierTrackingUrl(order.carrier, order.trackingNumber);

    return {
      orderId,
      event,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerPhone: order.customerPhone?.trim() || null,
      shippingAddress: order.shippingAddress?.trim() || null,
      total: order.total,
      couponCode: order.couponCode?.trim() || null,
      couponDiscountKurus: order.couponDiscountKurus ?? null,
      createdAt: order._creationTime,
      shippedAt: order.shippedAt ?? null,
      carrier: order.carrier?.trim() || null,
      trackingNumber: order.trackingNumber?.trim() || null,
      trackingUrl: trackingUrl || null,
      itemCount: order.items.length,
      items: order.items.slice(0, 30).map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        image: item.image ?? null,
        sku: item.sku ?? null,
      })),
      storeName,
      storeEmail,
      storePhone,
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
      idempotencyKey: `${event}/${orderId}`,
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

    if (args.status === "sent" || args.status === "failed") {
      const order = await ctx.db.get(event.orderId);
      const orderNumber = order ? ("orderNumber" in order && order.orderNumber ? String(order.orderNumber) : order._id.slice(-8).toUpperCase()) : "";
      const recipient = event.event === "admin_new_order"
        ? (process.env.ADMIN_ALERT_EMAIL || "delivered@resend.dev")
        : (order?.customerEmail || "Müşteri");

      await ctx.db.insert("emailLogs", {
        templateKey: event.event,
        recipient,
        subject: `Sipariş #${orderNumber} (${event.event})`,
        status: args.status === "sent" ? "sent" : "failed",
        error: args.error,
        metadata: {
          orderId: event.orderId,
          orderNumber,
          eventId: args.eventId,
        },
        createdAt: Date.now(),
      });
    }

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
      .take(4)));
    return events.flat();
  },
});



function formatTRY(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function buildEmail(payload: EmailPayload) {
  const shortOrderId = String(payload.orderId).slice(-8).toUpperCase();
  const discountAmount = payload.couponDiscountKurus ? payload.couponDiscountKurus / 100 : 0;
  const itemsSubtotal = payload.items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

  // Etkinliğe göre başlık, rozet ve karşılama metinleri
  let subject = `Siparişiniz Alındı — #${shortOrderId} | ${payload.storeName}`;
  let badgeText = "Sipariş Onaylandı";
  let badgeBg = "#ecfdf5";
  let badgeColor = "#047857";
  let badgeBorder = "#a7f3d0";
  let mainTitle = "Siparişiniz Alındı!";
  let heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, alışverişiniz için teşekkür ederiz. Siparişiniz başarıyla alındı ve ödemeniz onaylandı.`;
  let nextStepTitle = "📦 Sırada Ne Var?";
  let nextStepMessage = "Siparişiniz hazırlandığında ve kargoya verildiğinde, takip numarası ile birlikte yeni bir bilgilendirme e-postası alacaksınız.";

  if (payload.event === "order_shipped") {
    subject = `Siparişiniz Kargoya Verildi — #${shortOrderId} | ${payload.storeName}`;
    badgeText = "Kargoya Verildi";
    badgeBg = "#eff6ff";
    badgeColor = "#1d4ed8";
    badgeBorder = "#bfdbfe";
    mainTitle = "Siparişiniz Yola Çıktı! 🚚";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, müjde! Siparişiniz paketlendi ve kargo firmasına teslim edildi.`;
    nextStepTitle = "🚚 Teslimat Süreci";
    nextStepMessage = "Kargonuz yola çıktı. Aşağıdaki takip bilgilerini kullanarak gönderinizin nerede olduğunu anlık olarak takip edebilirsiniz.";
  } else if (payload.event === "order_cancelled") {
    subject = `Siparişiniz İptal Edildi — #${shortOrderId} | ${payload.storeName}`;
    badgeText = "İptal Edildi";
    badgeBg = "#fef2f2";
    badgeColor = "#b91c1c";
    badgeBorder = "#fecaca";
    mainTitle = "Sipariş İptal Edildi";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, #${shortOrderId} numaralı siparişiniz iptal edilmiştir. Varsa ödemeniz bankanıza bağlı olarak 1-7 iş günü içinde hesabınıza yansıyacaktır.`;
    nextStepTitle = "ℹ️ İade & İptal Bilgisi";
    nextStepMessage = "İptal işlemiyle ilgili herhangi bir sorunuz olursa müşteri destek ekibimizle iletişime geçebilirsiniz.";
  } else if (payload.event === "order_delivered") {
    subject = `Siparişiniz Teslim Edildi — #${shortOrderId} | ${payload.storeName}`;
    badgeText = "Teslim Edildi";
    badgeBg = "#ecfdf5";
    badgeColor = "#047857";
    badgeBorder = "#a7f3d0";
    mainTitle = "Siparişiniz Teslim Edildi! 🎉";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, siparişinizin teslimatı başarıyla tamamlandı. Ürünlerinizi güzel günlerde kullanmanızı dileriz!`;
    nextStepTitle = "⭐ Bizi Tercih Ettiğiniz İçin Teşekkürler";
    nextStepMessage = "Ürünlerinizden memnun kalmanızı umuyoruz. Deneyiminizi bizimle paylaşmak veya destek almak için her zaman bize ulaşabilirsiniz.";
  } else if (payload.event === "admin_new_order") {
    subject = `🔔 Yeni Sipariş Alındı! — #${shortOrderId} (${formatTRY(payload.total)}) | ${payload.storeName}`;
    badgeText = "Yeni Sipariş (Yönetici)";
    badgeBg = "#fffbeb";
    badgeColor = "#b45309";
    badgeBorder = "#fde68a";
    mainTitle = "Yeni Bir Sipariş Düştü!";
    heroMessage = `Mağazanızda <strong>${escapeHtml(payload.customerName)}</strong> tarafından yeni bir sipariş oluşturuldu ve ödemesi onaylandı. Sipariş kalemleri ve teslimat bilgileri aşağıdadır:`;
    nextStepTitle = "📋 Yönetici Notu";
    nextStepMessage = "Siparişi hazırlayıp kargoya verdiğinizde admin panelinden durumunu güncelleyerek müşteriye kargo takip kodunu iletebilirsiniz.";
  }

  // Düz Metin (Plain Text)
  const itemTextLines = payload.items.map(
    (item) => `• ${item.title} — ${item.quantity} adet × ${formatTRY(item.price)} = ${formatTRY(Number(item.price) * item.quantity)}`
  );

  const text = [
    `${payload.storeName.toUpperCase()} — ${badgeText.toUpperCase()}`,
    `----------------------------------------`,
    `Merhaba ${payload.customerName},`,
    mainTitle,
    ``,
    `Sipariş No: #${shortOrderId}`,
    `Sipariş ID: ${payload.orderId}`,
    `Tarih: ${formatDate(payload.createdAt)}`,
    ...(payload.event === "order_shipped" && payload.carrier ? [``, `Kargo Firması: ${payload.carrier}`, `Takip No: ${payload.trackingNumber || "—"}`, ...(payload.trackingUrl ? [`Takip Linki: ${payload.trackingUrl}`] : [])] : []),
    ...(payload.shippingAddress ? [``, `Teslimat Adresi:`, payload.shippingAddress] : []),
    ``,
    `Sipariş Kalemleri:`,
    ...itemTextLines,
    ``,
    `Toplam Tutar: ${formatTRY(payload.total)}`,
    ``,
    nextStepMessage,
    ``,
    `Sorularınız için bizimle iletişime geçebilirsiniz:`,
    ...(payload.storeEmail ? [`E-posta: ${payload.storeEmail}`] : []),
    ...(payload.storePhone ? [`Telefon: ${payload.storePhone}`] : []),
    `----------------------------------------`,
    `© ${payload.storeName}`,
  ].join("\n");

  // HTML Ürün Satırları
  const itemRowsHtml = payload.items.map((item) => {
    const itemTotal = Number(item.price) * item.quantity;
    const imageHtml = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;margin-right:12px;" />`
      : `<div style="width:56px;height:56px;border-radius:8px;background-color:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px;margin-right:12px;text-align:center;line-height:56px;">Görsel Yok</div>`;

    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:68px;vertical-align:middle;">
                ${imageHtml}
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:14px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</div>
                ${item.sku ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Kod: ${escapeHtml(item.sku)}</div>` : ""}
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

  // Kargo Bilgisi Kutucuğu (Sadece order_shipped için)
  const shippingCardHtml = payload.event === "order_shipped" ? `
    <tr>
      <td style="padding:0 32px 24px 32px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;padding:20px;">
          <tr>
            <td>
              <div style="font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">
                🚚 Kargo Takip Bilgileri
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-bottom:12px;">
                    <div style="font-size:12px;color:#4b5563;">Kargo Şirketi</div>
                    <div style="font-size:15px;font-weight:700;color:#111827;margin-top:2px;">${escapeHtml(payload.carrier || "Kargo")}</div>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-bottom:12px;">
                    <div style="font-size:12px;color:#4b5563;">Takip Numarası</div>
                    <div style="font-size:15px;font-weight:700;color:#111827;font-family:monospace;margin-top:2px;">${escapeHtml(payload.trackingNumber || "—")}</div>
                  </td>
                </tr>
              </table>
              ${payload.trackingUrl ? `
              <div style="margin-top:8px;">
                <a href="${escapeHtml(payload.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 20px;background-color:#16a34a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                  Kargonuzu Takip Edin &rarr;
                </a>
              </div>
              ` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

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
        <!-- Ana Konteyner -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Başlık & Marka -->
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.03em;">${escapeHtml(payload.storeName)}</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;padding:4px 12px;background-color:${badgeBg};color:${badgeColor};border-radius:9999px;font-size:12px;font-weight:600;border:1px solid ${badgeBorder};">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Karşılama & Sipariş Başlığı -->
          <tr>
            <td style="padding:32px 32px 20px 32px;">
              <h1 style="margin:0 0 10px 0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">${escapeHtml(mainTitle)}</h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                ${heroMessage}
              </p>
            </td>
          </tr>

          <!-- Kargo Takip Kartı (Varsa) -->
          ${shippingCardHtml}

          <!-- Sipariş Bilgi Kartı -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:10px;border:1px solid #f3f4f6;padding:16px;">
                <tr>
                  <td style="width:50%;vertical-align:top;padding:4px 8px;">
                    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Sipariş No</div>
                    <div style="font-size:15px;font-weight:700;color:#111827;margin-top:3px;">#${escapeHtml(shortOrderId)}</div>
                  </td>
                  <td style="width:50%;vertical-align:top;padding:4px 8px;">
                    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Sipariş Tarihi</div>
                    <div style="font-size:14px;font-weight:500;color:#111827;margin-top:3px;">${escapeHtml(formatDate(payload.createdAt))}</div>
                  </td>
                </tr>
                ${payload.shippingAddress ? `
                <tr>
                  <td colspan="2" style="padding:12px 8px 4px 8px;border-top:1px solid #e5e7eb;margin-top:10px;">
                    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Teslimat Adresi</div>
                    <div style="font-size:14px;color:#374151;margin-top:4px;line-height:1.5;">${escapeHtml(payload.shippingAddress)}</div>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

          <!-- Ürün Listesi Başlığı -->
          <tr>
            <td style="padding:0 32px 10px 32px;">
              <div style="font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #f3f4f6;padding-bottom:8px;">
                Sipariş Detayı (${payload.itemCount} ürün)
              </div>
            </td>
          </tr>

          <!-- Ürün Satırları -->
          <tr>
            <td style="padding:0 32px 16px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${itemRowsHtml}
              </table>
            </td>
          </tr>

          <!-- Tutar Özeti -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:10px;border:1px solid #f3f4f6;padding:16px;">
                <tr>
                  <td style="font-size:14px;color:#4b5563;padding:4px 0;">Ara Toplam</td>
                  <td style="font-size:14px;color:#111827;font-weight:600;text-align:right;padding:4px 0;">${escapeHtml(formatTRY(itemsSubtotal))}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="font-size:14px;color:#059669;padding:4px 0;">İndirim Kuponu (${escapeHtml(payload.couponCode || "")})</td>
                  <td style="font-size:14px;color:#059669;font-weight:600;text-align:right;padding:4px 0;">-${escapeHtml(formatTRY(discountAmount))}</td>
                </tr>
                ` : ""}
                <tr>
                  <td style="font-size:14px;color:#4b5563;padding:4px 0;">Kargo</td>
                  <td style="font-size:14px;color:#059669;font-weight:600;text-align:right;padding:4px 0;">Ücretsiz</td>
                </tr>
                <tr>
                  <td style="font-size:16px;color:#111827;font-weight:800;padding:12px 0 4px 0;border-top:1px solid #e5e7eb;">Toplam Tutar</td>
                  <td style="font-size:20px;color:#111827;font-weight:800;text-align:right;padding:12px 0 4px 0;border-top:1px solid #e5e7eb;">${escapeHtml(formatTRY(payload.total))}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bilgilendirme / Sonraki Adım -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eff6ff;border-radius:10px;border:1px solid #dbeafe;padding:16px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:13px;color:#1e40af;line-height:1.5;">
                      <strong>${escapeHtml(nextStepTitle)}</strong><br />
                      ${escapeHtml(nextStepMessage)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alt Bilgi (Footer) -->
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">
                Bir sorunuz mu var? 
                ${payload.storeEmail ? `<a href="mailto:${escapeHtml(payload.storeEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(payload.storeEmail)}</a>` : ""}
                ${payload.storePhone ? ` veya <strong>${escapeHtml(payload.storePhone)}</strong>` : ""} üzerinden bize ulaşabilirsiniz.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${escapeHtml(payload.storeName)}. Bu e-posta sipariş teyidi için otomatik olarak gönderilmiştir.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

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

    const record = await ctx.runQuery(internal.notifications.getEventById, { eventId });
    if (!record) return null;

    const from = formatSender(payload.storeName);
    const content = buildEmail(payload);
    const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL || payload.storeEmail || "delivered@resend.dev";
    const recipient = payload.event === "admin_new_order" ? adminAlertEmail : payload.customerEmail;

    const result = await sendResendEmail({
      to: recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
      from,
      idempotencyKey: record.idempotencyKey,
      replyTo: payload.storeEmail || undefined,
    });

    if (result.ok) {
      await ctx.runMutation(internal.notifications.recordSendResult, {
        eventId,
        status: "sent",
      });
    } else {
      const isConfigError = result.status === 0;
      const isServerOrTimeout = result.status >= 500 || result.error?.includes("zaman aşımı") || result.error?.includes("Timeout");
      await ctx.runMutation(internal.notifications.recordSendResult, {
        eventId,
        status: isConfigError ? "not_configured" : isServerOrTimeout ? "review" : "failed",
        error: result.error,
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
    if (!order) throw new Error("Sipariş bulunamadı.");

    const canRetry =
      (event === "payment_confirmation" && order.status !== "pending") ||
      (event === "admin_new_order" && order.status !== "pending") ||
      (event === "order_shipped" && (order.status === "shipped" || order.status === "delivered")) ||
      (event === "order_cancelled" && order.status === "cancelled") ||
      (event === "order_delivered" && order.status === "delivered");

    if (!canRetry) throw new Error("Bu e-posta türü için sipariş durumu uygun değil.");

    const existing = await ctx.db.query("orderEmailEvents")
      .withIndex("by_order_and_event", (q) => q.eq("orderId", orderId).eq("event", event))
      .unique();
    if (existing?.status === "review") throw new Error("Gönderim sonucu belirsiz. Resend panelini kontrol edin; otomatik tekrar kapalı.");

    await ctx.scheduler.runAfter(0, internal.notifications.sendForOrderScheduled, { orderId, event });
    return null;
  },
});


