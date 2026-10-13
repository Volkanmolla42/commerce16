import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml, formatSender, sendResendEmail } from "./mailUtils";
import { EMAIL_ICONS } from "./emailTemplates";
import { defaultPaymentSettings } from "./payments";
import { formatOrderCode, getOrderCode, resolveCarrierTrackingUrl } from "../lib/orders";
import { formatMoney } from "../lib/format-money";
import { formatDateTime } from "../lib/format-date";
import { formatIban } from "../lib/iban";

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

const bankAccountEmailValidator = v.object({
  bankName: v.string(),
  accountHolder: v.string(),
  iban: v.string(),
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
  paymentMethod: v.optional(v.union(v.literal("cash_on_delivery"), v.literal("bank_transfer"), v.literal("paytr"), v.null())),
  paymentMethodTitle: v.optional(v.union(v.string(), v.null())),
  paymentFee: v.optional(v.union(v.number(), v.null())),
  orderStatus: v.optional(v.string()),
  bankAccounts: v.optional(v.array(bankAccountEmailValidator)),
  bankTransferInstructions: v.optional(v.union(v.string(), v.null())),
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
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "paytr" | null;
  paymentMethodTitle?: string | null;
  paymentFee?: number | null;
  orderStatus?: string;
  bankAccounts?: Array<{ bankName: string; accountHolder: string; iban: string }>;
  bankTransferInstructions?: string | null;
};

export { resolveCarrierTrackingUrl };

export const getOrderEmailPayload = internalQuery({
  args: { orderId: v.id("orders"), event: eventValidator },
  returns: v.union(emailPayloadValidator, v.null()),
  handler: async (ctx, { orderId, event }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    // Durum kontrolü: Her bildirim kendi geçerli sipariş statüsünde gönderilir
    // payment_confirmation: Hem ödenmiş siparişler hem de havale/kapıda ödeme ile beklemedeki siparişler için sipariş alındı onayıdır
    if (event === "payment_confirmation" && order.status === "cancelled") return null;
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

    let bankAccounts: Array<{ bankName: string; accountHolder: string; iban: string }> | undefined = undefined;
    let bankTransferInstructions: string | null = null;

    if (order.paymentMethod === "bank_transfer") {
      const paymentSettingsDoc = await ctx.db
        .query("paymentSettings")
        .withIndex("by_key", (q) => q.eq("key", "payment"))
        .unique();
      const accounts = paymentSettingsDoc?.bankTransfer?.accounts ?? defaultPaymentSettings.bankTransfer.accounts;
      bankAccounts = accounts.map((acc) => ({
        bankName: acc.bankName,
        accountHolder: acc.accountHolder,
        iban: acc.iban,
      }));
      bankTransferInstructions =
        paymentSettingsDoc?.bankTransfer?.description ||
        defaultPaymentSettings.bankTransfer.description;
    }

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
      paymentMethod: order.paymentMethod ?? null,
      paymentMethodTitle: order.paymentMethodTitle ?? null,
      paymentFee: order.paymentFee ?? null,
      orderStatus: order.status,
      bankAccounts,
      bankTransferInstructions,
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
      const orderNumber = getOrderCode(order);
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
  return formatMoney(value);
}

function formatDate(timestamp: number) {
  return formatDateTime(timestamp, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildEmail(payload: EmailPayload) {
  const shortOrderId = formatOrderCode(payload.orderId);
  const discountAmount = payload.couponDiscountKurus ? payload.couponDiscountKurus / 100 : 0;
  const itemsSubtotal = payload.items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

  // Etkinliğe göre başlık, ikon ve karşılama metinleri
  let subject = `Siparişiniz Alındı — #${shortOrderId} | ${payload.storeName}`;
  let iconSvg = EMAIL_ICONS.checkCircle;
  let mainTitle = "Siparişiniz Alındı";
  let heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, siparişiniz başarıyla alındı ve ödemeniz onaylandı.`;
  let nextStepTitle = "Sırada Ne Var?";
  let nextStepMessage = "Siparişiniz hazırlandığında ve kargoya verildiğinde takip numarası ile birlikte yeni bir bilgilendirme e-postası alacaksınız.";

  let badgeText = "Sipariş Alındı";
  let badgeBg = "#ecfdf5";
  let badgeColor = "#059669";
  let badgeBorder = "#a7f3d0";

  if (payload.event === "payment_confirmation") {
    if (payload.paymentMethod === "bank_transfer") {
      subject = `Siparişiniz Alındı (Havale/EFT Bekleniyor) — #${shortOrderId} | ${payload.storeName}`;
      mainTitle = "Siparişiniz Alındı — Ödeme Bekleniyor";
      heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, #${shortOrderId} numaralı siparişiniz oluşturuldu. Siparişinizin onaylanıp kargoya hazırlanması için lütfen aşağıdaki banka hesabımıza havale/EFT yapınız.`;
      nextStepTitle = "Havale / EFT Talimatı";
      nextStepMessage = `${payload.bankTransferInstructions || "Lütfen havale yaparken açıklama kısmına sipariş numaranızı yazınız."} (Sipariş No: #${shortOrderId})`;
      badgeText = "Ödeme Bekleniyor";
      badgeBg = "#fffbeb";
      badgeColor = "#b45309";
      badgeBorder = "#fde68a";
    } else if (payload.paymentMethod === "cash_on_delivery") {
      subject = `Siparişiniz Alındı (Kapıda Ödeme) — #${shortOrderId} | ${payload.storeName}`;
      mainTitle = "Siparişiniz Alındı";
      heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, siparişiniz başarıyla alındı. Teslimat sırasında nakit veya kartla kapıda ödeyebilirsiniz.`;
      nextStepTitle = "Teslimat ve Ödeme";
      nextStepMessage = "Siparişiniz paketlenip kargoya verilecektir. Kargo teslimatı anında nakit veya kart ile ödemenizi yapabilirsiniz.";
      badgeText = "Kapıda Ödeme";
      badgeBg = "#f0fdf4";
      badgeColor = "#16a34a";
      badgeBorder = "#bbf7d0";
    } else {
      badgeText = "Ödeme Onaylandı";
    }
  } else if (payload.event === "order_shipped") {
    subject = `Siparişiniz Kargoya Verildi — #${shortOrderId} | ${payload.storeName}`;
    iconSvg = EMAIL_ICONS.truck;
    mainTitle = "Siparişiniz Yola Çıktı";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, siparişiniz paketlendi ve kargo firmasına teslim edildi.`;
    nextStepTitle = "Teslimat Süreci";
    nextStepMessage = "Kargonuz yola çıktı. Aşağıdaki takip bilgilerini kullanarak gönderinizin nerede olduğunu anlık olarak takip edebilirsiniz.";
    badgeText = "Kargoda";
    badgeBg = "#eff6ff";
    badgeColor = "#2563eb";
    badgeBorder = "#bfdbfe";
  } else if (payload.event === "order_cancelled") {
    subject = `Siparişiniz İptal Edildi — #${shortOrderId} | ${payload.storeName}`;
    iconSvg = EMAIL_ICONS.alertCircle;
    mainTitle = "Sipariş İptal Edildi";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, #${shortOrderId} numaralı siparişiniz iptal edilmiştir. Varsa ödemeniz bankanıza bağlı olarak 1-7 iş günü içinde hesabınıza yansıyacaktır.`;
    nextStepTitle = "İade & İptal Bilgisi";
    nextStepMessage = "İptal işlemiyle ilgili herhangi bir sorunuz olursa müşteri destek ekibimizle iletişime geçebilirsiniz.";
    badgeText = "İptal Edildi";
    badgeBg = "#fef2f2";
    badgeColor = "#dc2626";
    badgeBorder = "#fecaca";
  } else if (payload.event === "order_delivered") {
    subject = `Siparişiniz Teslim Edildi — #${shortOrderId} | ${payload.storeName}`;
    iconSvg = EMAIL_ICONS.packageCheck;
    mainTitle = "Siparişiniz Teslim Edildi";
    heroMessage = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, siparişinizin teslimatı başarıyla tamamlandı. Ürünlerinizi güzel günlerde kullanmanızı dileriz.`;
    nextStepTitle = "Teşekkür Ederiz";
    nextStepMessage = "Bizi tercih ettiğiniz için teşekkür ederiz. Destek almak için her zaman bize ulaşabilirsiniz.";
    badgeText = "Teslim Edildi";
    badgeBg = "#f0fdf4";
    badgeColor = "#16a34a";
    badgeBorder = "#bbf7d0";
  } else if (payload.event === "admin_new_order") {
    subject = `Yeni Sipariş Alındı: #${shortOrderId} (${formatTRY(payload.total)}) | ${payload.storeName}`;
    iconSvg = EMAIL_ICONS.bell;
    mainTitle = "Yeni Sipariş Alındı";
    heroMessage = `Mağazanızda <strong>${escapeHtml(payload.customerName)}</strong> tarafından yeni bir sipariş oluşturuldu. Ödeme yöntemi: ${escapeHtml(payload.paymentMethodTitle || "Belirtilmemiş")}.`;
    nextStepTitle = "Yönetici Notu";
    nextStepMessage = "Siparişi hazırlayıp kargoya verdiğinizde admin panelinden durumunu güncelleyerek müşteriye kargo takip kodunu iletebilirsiniz.";
    badgeText = "Yeni Sipariş";
    badgeBg = "#faf5ff";
    badgeColor = "#7c3aed";
    badgeBorder = "#e9d5ff";
  }

  // Düz Metin (Plain Text)
  const itemTextLines = payload.items.map(
    (item) => `• ${item.title} — ${item.quantity} adet × ${formatTRY(item.price)} = ${formatTRY(Number(item.price) * item.quantity)}`
  );

  const text = [
    `${payload.storeName.toUpperCase()} — ${mainTitle.toUpperCase()}`,
    `----------------------------------------`,
    `Merhaba ${payload.customerName},`,
    mainTitle,
    ``,
    `Sipariş No: #${shortOrderId}`,
    `Sipariş ID: ${payload.orderId}`,
    `Tarih: ${formatDate(payload.createdAt)}`,
    ...(payload.paymentMethodTitle ? [`Ödeme Yöntemi: ${payload.paymentMethodTitle}`] : []),
    ...(payload.event === "order_shipped" && payload.carrier ? [``, `Kargo Firması: ${payload.carrier}`, `Takip No: ${payload.trackingNumber || "—"}`, ...(payload.trackingUrl ? [`Takip Linki: ${payload.trackingUrl}`] : [])] : []),
    ...(payload.bankAccounts && payload.bankAccounts.length > 0 ? [
      ``,
      `=== HAVALE / EFT BİLGİLERİ ===`,
      `Lütfen havale/EFT yaparken açıklama alanına #${shortOrderId} sipariş numaranızı yazınız.`,
      ...payload.bankAccounts.map((acc) => `• ${acc.bankName} | ${acc.accountHolder} | IBAN: ${acc.iban}`),
    ] : []),
    ...(payload.shippingAddress ? [``, `Teslimat Adresi:`, payload.shippingAddress] : []),
    ``,
    `Sipariş Kalemleri:`,
    ...itemTextLines,
    ...(payload.paymentFee && payload.paymentFee > 0 ? [``, `Kapıda Ödeme Hizmet Bedeli: +${formatTRY(payload.paymentFee)}`] : []),
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
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #e4e4e7;margin-right:12px;" />`
      : `<div style="width:52px;height:52px;border-radius:6px;background-color:#f4f4f5;border:1px solid #e4e4e7;display:flex;align-items:center;justify-content:center;color:#a1a1aa;font-size:10px;margin-right:12px;text-align:center;line-height:52px;">Görsel Yok</div>`;

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:64px;vertical-align:middle;">
                ${imageHtml}
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:13px;font-weight:600;color:#09090b;line-height:1.4;">${escapeHtml(item.title)}</div>
                ${item.sku ? `<div style="font-size:11px;color:#71717a;margin-top:2px;">Kod: ${escapeHtml(item.sku)}</div>` : ""}
                <div style="font-size:12px;color:#71717a;margin-top:2px;">${item.quantity} adet × ${escapeHtml(formatTRY(item.price))}</div>
              </td>
              <td style="vertical-align:middle;text-align:right;font-size:13px;font-weight:600;color:#09090b;">
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
      <td style="padding:0 28px 20px 28px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-radius:8px;border:1px solid #f0f0f0;padding:16px;">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
                Kargo Takip Bilgileri
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-bottom:10px;">
                    <div style="font-size:11px;color:#71717a;">Kargo Şirketi</div>
                    <div style="font-size:14px;font-weight:600;color:#09090b;margin-top:2px;">${escapeHtml(payload.carrier || "Kargo")}</div>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-bottom:10px;">
                    <div style="font-size:11px;color:#71717a;">Takip Numarası</div>
                    <div style="font-size:14px;font-weight:600;color:#09090b;font-family:ui-monospace,monospace;margin-top:2px;">${escapeHtml(payload.trackingNumber || "—")}</div>
                  </td>
                </tr>
              </table>
              ${payload.trackingUrl ? `
              <div style="margin-top:6px;">
                <a href="${escapeHtml(payload.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:9px 20px;background-color:#09090b;color:#ffffff !important;text-decoration:none;font-size:12px;font-weight:600;border-radius:6px;">
                  Kargoyu Takip Et &rarr;
                </a>
              </div>
              ` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  // Havale / EFT Banka Hesapları Kutucuğu
  const bankAccountsHtml = payload.bankAccounts && payload.bankAccounts.length > 0 ? `
    <tr>
      <td style="padding:0 28px 20px 28px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffbeb;border-radius:8px;border:1px solid #fef08a;padding:16px;">
          <tr>
            <td>
              <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
                Havale / EFT Yapılacak Banka Hesapları
              </div>
              <p style="margin:0 0 10px 0;font-size:12px;color:#b45309;line-height:1.4;">
                Lütfen havale/EFT yaparken açıklama kısmına mutlaka sipariş numaranızı (<strong style="color:#78350f;">#${shortOrderId}</strong>) yazınız.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${payload.bankAccounts.map((acc) => `
                  <tr>
                    <td style="padding:8px 0;border-top:1px solid #fef3c7;">
                      <div style="font-size:13px;font-weight:700;color:#78350f;">${escapeHtml(acc.bankName)}</div>
                      <div style="font-size:12px;color:#92400e;margin-top:2px;">Hesap Sahibi: ${escapeHtml(acc.accountHolder)}</div>
                      <div style="font-size:12px;font-family:ui-monospace,monospace;font-weight:600;color:#09090b;margin-top:3px;letter-spacing:0.02em;">IBAN: ${escapeHtml(formatIban(acc.iban))}</div>
                    </td>
                  </tr>
                `).join("")}
              </table>
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
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#09090b;line-height:1.5;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Ana Konteyner -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;border-collapse:separate;">
          
          <!-- Başlık & Marka -->
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #f4f4f5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-size:16px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">${escapeHtml(payload.storeName)}</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <span style="display:inline-block;padding:3px 10px;background-color:${badgeBg};color:${badgeColor};border-radius:9999px;font-size:11px;font-weight:600;border:1px solid ${badgeBorder};text-transform:uppercase;letter-spacing:0.05em;">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Karşılama & Sipariş Başlığı -->
          <tr>
            <td style="padding:28px 28px 16px 28px;">
              <div style="margin-bottom:14px;color:#09090b;">
                ${iconSvg}
              </div>
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">${escapeHtml(mainTitle)}</h1>
              <p style="margin:0;font-size:14px;color:#52525b;line-height:1.6;">
                ${heroMessage}
              </p>
            </td>
          </tr>

          <!-- Havale / EFT Banka Hesapları (Varsa) -->
          ${bankAccountsHtml}

          <!-- Kargo Takip Kartı (Varsa) -->
          ${shippingCardHtml}

          <!-- Sipariş Bilgi Kartı -->
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-radius:8px;border:1px solid #f0f0f0;padding:16px;">
                <tr>
                  <td style="width:50%;vertical-align:top;padding:2px 6px;">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Sipariş No</div>
                    <div style="font-size:14px;font-weight:600;color:#09090b;margin-top:2px;">#${escapeHtml(shortOrderId)}</div>
                  </td>
                  <td style="width:50%;vertical-align:top;padding:2px 6px;">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Sipariş Tarihi</div>
                    <div style="font-size:13px;font-weight:500;color:#09090b;margin-top:2px;">${escapeHtml(formatDate(payload.createdAt))}</div>
                  </td>
                </tr>
                ${payload.shippingAddress ? `
                <tr>
                  <td colspan="2" style="padding:10px 6px 2px 6px;border-top:1px solid #f0f0f0;margin-top:8px;">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Teslimat Adresi</div>
                    <div style="font-size:13px;color:#09090b;margin-top:3px;line-height:1.5;">${escapeHtml(payload.shippingAddress)}</div>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

          <!-- Ürün Listesi Başlığı -->
          <tr>
            <td style="padding:0 28px 8px 28px;">
              <div style="font-size:13px;font-weight:600;color:#09090b;border-bottom:1px solid #f4f4f5;padding-bottom:8px;">
                Sipariş Kalemleri (${payload.itemCount} ürün)
              </div>
            </td>
          </tr>

          <!-- Ürün Satırları -->
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${itemRowsHtml}
              </table>
            </td>
          </tr>

          <!-- Tutar Özeti -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-radius:8px;border:1px solid #f0f0f0;padding:14px 16px;">
                <tr>
                  <td style="font-size:13px;color:#52525b;padding:3px 0;">Ara Toplam</td>
                  <td style="font-size:13px;color:#09090b;font-weight:600;text-align:right;padding:3px 0;">${escapeHtml(formatTRY(itemsSubtotal))}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="font-size:13px;color:#16a34a;padding:3px 0;">İndirim Kuponu (${escapeHtml(payload.couponCode || "")})</td>
                  <td style="font-size:13px;color:#16a34a;font-weight:600;text-align:right;padding:3px 0;">-${escapeHtml(formatTRY(discountAmount))}</td>
                </tr>
                ` : ""}
                ${payload.paymentMethodTitle ? `
                <tr>
                  <td style="font-size:13px;color:#52525b;padding:3px 0;">Ödeme Yöntemi</td>
                  <td style="font-size:13px;color:#09090b;font-weight:600;text-align:right;padding:3px 0;">${escapeHtml(payload.paymentMethodTitle)}</td>
                </tr>
                ` : ""}
                ${payload.paymentFee && payload.paymentFee > 0 ? `
                <tr>
                  <td style="font-size:13px;color:#52525b;padding:3px 0;">Kapıda Ödeme Hizmet Bedeli</td>
                  <td style="font-size:13px;color:#09090b;font-weight:600;text-align:right;padding:3px 0;">+${escapeHtml(formatTRY(payload.paymentFee))}</td>
                </tr>
                ` : ""}
                <tr>
                  <td style="font-size:13px;color:#52525b;padding:3px 0;">Kargo</td>
                  <td style="font-size:13px;color:#09090b;font-weight:600;text-align:right;padding:3px 0;">Ücretsiz</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#09090b;font-weight:700;padding:10px 0 2px 0;border-top:1px solid #e4e4e7;">Toplam Tutar</td>
                  <td style="font-size:16px;color:#09090b;font-weight:700;text-align:right;padding:10px 0 2px 0;border-top:1px solid #e4e4e7;">${escapeHtml(formatTRY(payload.total))}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bilgilendirme / Sonraki Adım -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-radius:8px;border:1px solid #f0f0f0;padding:14px 16px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:12px;color:#52525b;line-height:1.5;">
                      <strong style="color:#09090b;">${escapeHtml(nextStepTitle)}</strong><br />
                      ${escapeHtml(nextStepMessage)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alt Bilgi (Footer) -->
          <tr>
            <td style="padding:18px 28px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#71717a;">
                Bir sorunuz mu var? 
                ${payload.storeEmail ? `<a href="mailto:${escapeHtml(payload.storeEmail)}" style="color:#09090b;text-decoration:underline;">${escapeHtml(payload.storeEmail)}</a>` : ""}
                ${payload.storePhone ? ` veya <strong>${escapeHtml(payload.storePhone)}</strong>` : ""} üzerinden bize ulaşabilirsiniz.
              </p>
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                © ${escapeHtml(payload.storeName)} — Tüm hakları saklıdır.
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


