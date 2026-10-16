import { v, type Infer } from "convex/values";
import { formatMoney } from "../../../lib/format-money";
import { formatDateTime } from "../../../lib/format-date";
import { formatIban } from "../../../lib/iban";
import { escapeHtml } from "../../../lib/html";
import {
  field,
  fieldTable,
  ICONS,
  itemRows,
  panel,
  renderEmail,
  renderText,
  type EmailContent,
  type EmailLineItem,
  type EmailTone,
} from "../content";
import { orderEmailEventValidator, type OrderEmailEvent } from "../events";
import type { EmailPreviewStore } from "../registry";

export { orderEmailEventValidator, type OrderEmailEvent };

const orderEmailItemValidator = v.object({
  title: v.string(),
  quantity: v.number(),
  price: v.string(),
  image: v.union(v.string(), v.null()),
  sku: v.union(v.string(), v.null()),
});

const bankAccountValidator = v.object({
  bankName: v.string(),
  accountHolder: v.string(),
  iban: v.string(),
});

export const orderEmailPayloadValidator = v.object({
  event: orderEmailEventValidator,
  orderCode: v.string(),
  customerEmail: v.string(),
  customerName: v.string(),
  shippingAddress: v.union(v.string(), v.null()),
  total: v.string(),
  couponCode: v.union(v.string(), v.null()),
  couponDiscountKurus: v.union(v.number(), v.null()),
  createdAt: v.number(),
  carrier: v.union(v.string(), v.null()),
  trackingNumber: v.union(v.string(), v.null()),
  trackingUrl: v.union(v.string(), v.null()),
  itemCount: v.number(),
  items: v.array(orderEmailItemValidator),
  storeName: v.string(),
  storeEmail: v.union(v.string(), v.null()),
  storePhone: v.union(v.string(), v.null()),
  paymentMethod: v.union(v.literal("cash_on_delivery"), v.literal("bank_transfer"), v.literal("paytr"), v.null()),
  paymentMethodTitle: v.union(v.string(), v.null()),
  paymentFee: v.union(v.number(), v.null()),
  shippingFee: v.optional(v.union(v.number(), v.null())),
  bankAccounts: v.array(bankAccountValidator),
  bankTransferInstructions: v.string(),
});

export type OrderEmailPayload = Infer<typeof orderEmailPayloadValidator>;

interface OrderCopy {
  subject: string;
  icon: string;
  title: string;
  intro: string;
  badge: { text: string; tone: EmailTone };
  nextStepTitle: string;
  nextStepMessage: string;
}

function copyFor(payload: OrderEmailPayload): OrderCopy {
  const greeting = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, `;
  const code = payload.orderCode;

  switch (payload.event) {
    case "payment_confirmed":
      return {
        subject: `Ödemeniz Onaylandı — #${code} | ${payload.storeName}`,
        icon: ICONS.checkCircle,
        title: "Ödemeniz Onaylandı",
        intro: `${greeting}#${code} numaralı siparişinizin ödemesi alındı. Siparişiniz hazırlanmaya başlandı.`,
        badge: { text: "Ödeme Onaylandı", tone: "success" },
        nextStepTitle: "Sırada Ne Var?",
        nextStepMessage:
          "Siparişiniz kargoya verildiğinde takip numarası ile birlikte yeni bir bilgilendirme e-postası alacaksınız.",
      };
    case "order_shipped":
      return {
        subject: `Siparişiniz Kargoya Verildi — #${code} | ${payload.storeName}`,
        icon: ICONS.truck,
        title: "Siparişiniz Yola Çıktı",
        intro: `${greeting}#${code} numaralı siparişiniz paketlendi ve kargo firmasına teslim edildi.`,
        badge: { text: "Kargoda", tone: "info" },
        nextStepTitle: "Teslimat Süreci",
        nextStepMessage:
          "Kargonuz yola çıktı. Aşağıdaki takip bilgilerini kullanarak gönderinizin nerede olduğunu anlık olarak izleyebilirsiniz.",
      };
    case "order_delivered":
      return {
        subject: `Siparişiniz Teslim Edildi — #${code} | ${payload.storeName}`,
        icon: ICONS.packageCheck,
        title: "Siparişiniz Teslim Edildi",
        intro: `${greeting}#${code} numaralı siparişinizin teslimatı başarıyla tamamlandı. Ürünlerinizi güzel günlerde kullanmanızı dileriz.`,
        badge: { text: "Teslim Edildi", tone: "success" },
        nextStepTitle: "Teşekkür Ederiz",
        nextStepMessage:
          "Bizi tercih ettiğiniz için teşekkür ederiz. Destek almak için her zaman bize ulaşabilirsiniz.",
      };
    case "order_cancelled":
      return {
        subject: `Siparişiniz İptal Edildi — #${code} | ${payload.storeName}`,
        icon: ICONS.alertCircle,
        title: "Sipariş İptal Edildi",
        intro: `${greeting}#${code} numaralı siparişiniz iptal edilmiştir. Varsa ödemeniz bankanıza bağlı olarak 1-7 iş günü içinde hesabınıza yansıyacaktır.`,
        badge: { text: "İptal Edildi", tone: "danger" },
        nextStepTitle: "İade & İptal Bilgisi",
        nextStepMessage:
          "İptal işlemiyle ilgili herhangi bir sorunuz olursa müşteri destek ekibimizle iletişime geçebilirsiniz.",
      };
    case "admin_order_alert":
      return {
        subject: `Yeni Sipariş Alındı: #${code} (${formatMoney(payload.total)}) | ${payload.storeName}`,
        icon: ICONS.bell,
        title: "Yeni Sipariş Alındı",
        intro: `<strong>${escapeHtml(payload.customerName)}</strong> tarafından yeni bir sipariş oluşturuldu. Ödeme yöntemi: ${escapeHtml(payload.paymentMethodTitle || "Belirtilmemiş")}.`,
        badge: { text: "Yeni Sipariş", tone: "accent" },
        nextStepTitle: "Yönetici Notu",
        nextStepMessage:
          "Siparişi hazırlayıp kargoya verdiğinizde admin panelinden durumu güncelleyerek müşteriye kargo takip kodunu iletebilirsiniz.",
      };
    case "order_placed":
      return placedCopy(payload);
  }
}

/** Sipariş oluşturma e-postasının metni, seçilen ödeme yöntemine göre değişir. */
function placedCopy(payload: OrderEmailPayload): OrderCopy {
  const greeting = `Merhaba <strong>${escapeHtml(payload.customerName)}</strong>, `;
  const code = payload.orderCode;
  const base = {
    icon: ICONS.checkCircle,
    title: "Siparişiniz Alındı",
  };

  if (payload.paymentMethod === "bank_transfer") {
    return {
      ...base,
      subject: `Siparişiniz Alındı (Havale/EFT Bekleniyor) — #${code} | ${payload.storeName}`,
      title: "Siparişiniz Alındı — Ödeme Bekleniyor",
      intro: `${greeting}#${code} numaralı siparişiniz oluşturuldu. Onaylanıp kargoya hazırlanması için lütfen aşağıdaki banka hesabımıza havale/EFT yapınız.`,
      badge: { text: "Ödeme Bekleniyor", tone: "warning" },
      nextStepTitle: "Havale / EFT Talimatı",
      nextStepMessage: `${payload.bankTransferInstructions} (Sipariş No: #${code})`,
    };
  }

  if (payload.paymentMethod === "cash_on_delivery") {
    return {
      ...base,
      subject: `Siparişiniz Alındı (Kapıda Ödeme) — #${code} | ${payload.storeName}`,
      intro: `${greeting}siparişiniz başarıyla alındı. Teslimat sırasında nakit veya kartla kapıda ödeyebilirsiniz.`,
      badge: { text: "Kapıda Ödeme", tone: "success" },
      nextStepTitle: "Teslimat ve Ödeme",
      nextStepMessage:
        "Siparişiniz paketlenip kargoya verilecektir. Kargo teslimatı anında nakit veya kart ile ödemenizi yapabilirsiniz.",
    };
  }

  return {
    ...base,
    subject: `Siparişiniz Alındı (Ödeme Bekleniyor) — #${code} | ${payload.storeName}`,
    title: "Siparişiniz Alındı — Ödeme Bekleniyor",
    intro: `${greeting}#${code} numaralı siparişiniz oluşturuldu. Ödemeniz doğrulandığında siparişiniz işleme alınacaktır.`,
    badge: { text: "Ödeme Bekleniyor", tone: "warning" },
    nextStepTitle: "Ödeme Doğrulaması",
    nextStepMessage: "Ödemeniz onaylandığında sizinle ayrıca paylaşacağız.",
  };
}

function totalRow(label: string, value: string, strong = false): string {
  return `<tr>
  <td style="font-size:${strong ? "14px" : "13px"};color:${strong ? "#09090b" : "#52525b"};font-weight:${strong ? "700" : "400"};padding:${strong ? "8px 0 2px" : "3px 0"};${strong ? "border-top:1px solid #e4e4e7;" : ""}">${escapeHtml(label)}</td>
  <td style="font-size:${strong ? "15px" : "13px"};color:#09090b;font-weight:${strong ? "700" : "600"};text-align:right;padding:${strong ? "8px 0 2px" : "3px 0"};white-space:nowrap;${strong ? "border-top:1px solid #e4e4e7;" : ""}">${value}</td>
</tr>`;
}

function trackingCta(trackingUrl: string): string {
  return `<div style="margin-top:6px;">
  <a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:9px 20px;background-color:#09090b;color:#ffffff !important;text-decoration:none;font-size:12px;font-weight:600;border-radius:6px;">Kargoyu Takip Et &rarr;</a>
</div>`;
}

export function renderOrderEmail(payload: OrderEmailPayload): EmailContent {
  const copy = copyFor(payload);
  const items: EmailLineItem[] = payload.items.map((item) => ({
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    image: item.image,
    meta: item.sku ? `Kod: ${item.sku}` : null,
  }));
  const itemsSubtotal = items.reduce(
    (acc, item) => acc + Number(item.price) * item.quantity,
    0
  );
  const discount = payload.couponDiscountKurus ? payload.couponDiscountKurus / 100 : 0;
  const dateText = formatDateTime(payload.createdAt, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalsRows = `<table cellpadding="0" cellspacing="0" border="0" width="100%">
  ${totalRow("Ara Toplam", escapeHtml(formatMoney(itemsSubtotal)))}
  ${discount > 0 ? totalRow(`İndirim Kuponu (${payload.couponCode || ""})`, `<span style="color:#16a34a;">-${escapeHtml(formatMoney(discount))}</span>`) : ""}
  ${payload.paymentMethodTitle ? totalRow("Ödeme Yöntemi", escapeHtml(payload.paymentMethodTitle)) : ""}
  ${totalRow("Kargo", payload.shippingFee && payload.shippingFee > 0 ? `+${escapeHtml(formatMoney(payload.shippingFee))}` : "Ücretsiz")}
  ${payload.paymentFee && payload.paymentFee > 0 ? totalRow("Kapıda Ödeme Hizmet Bedeli", `+${escapeHtml(formatMoney(payload.paymentFee))}`) : ""}
  ${totalRow("Toplam Tutar", escapeHtml(formatMoney(payload.total)), true)}
</table>`;

  const bankHtml = payload.bankAccounts.length
    ? panel(
        "Havale / EFT Yapılacak Banka Hesapları",
        `<p style="margin:0 0 10px 0;font-size:12px;color:#b45309;line-height:1.4;">Lütfen havale/EFT yaparken açıklama kısmına mutlaka sipariş numaranızı (<strong>#${escapeHtml(payload.orderCode)}</strong>) yazınız.</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
  ${payload.bankAccounts
    .map(
      (account) => `<tr><td style="padding:8px 0;border-top:1px solid #fef3c7;">
    <div style="font-size:13px;font-weight:700;color:#78350f;">${escapeHtml(account.bankName)}</div>
    <div style="font-size:12px;color:#92400e;margin-top:2px;">Hesap Sahibi: ${escapeHtml(account.accountHolder)}</div>
    <div style="font-size:12px;font-family:ui-monospace,monospace;font-weight:600;color:#09090b;margin-top:3px;">IBAN: ${escapeHtml(formatIban(account.iban))}</div>
  </td></tr>`
    )
    .join("")}
</table>`,
        "warning"
      )
    : false;

  const trackingHtml =
    payload.event === "order_shipped"
      ? panel(
          "Kargo Takip Bilgileri",
          `${fieldTable([
            field("Kargo Şirketi", `<strong>${escapeHtml(payload.carrier || "—")}</strong>`),
            field("Takip Numarası", `<span style="font-family:ui-monospace,monospace;font-weight:600;">${escapeHtml(payload.trackingNumber || "—")}</span>`),
          ])}
          ${payload.trackingUrl ? trackingCta(payload.trackingUrl) : ""}`
        )
      : false;

  const infoHtml = panel(
    "Sipariş Bilgileri",
    fieldTable([
      field("Sipariş No", `<strong>#${escapeHtml(payload.orderCode)}</strong>`),
      field("Tarih", escapeHtml(dateText)),
      payload.shippingAddress
        ? field("Teslimat Adresi", `<span style="line-height:1.5;">${escapeHtml(payload.shippingAddress)}</span>`)
        : ""
    ])
  );

  const itemsHtml = panel(
    `Sipariş Kalemleri (${payload.itemCount} ürün)`,
    `<table cellpadding="0" cellspacing="0" border="0" width="100%">${itemRows(items)}</table>`
  );

  const nextStepHtml = panel(
    copy.nextStepTitle,
    `<p style="margin:0;font-size:12px;color:#52525b;line-height:1.5;">${escapeHtml(copy.nextStepMessage)}</p>`
  );

  const contactHtml =
    payload.storeEmail || payload.storePhone
      ? `<p style="margin:0 0 4px 0;font-size:12px;color:#71717a;">Bir sorunuz mu var? ${payload.storeEmail ? `<a href="mailto:${escapeHtml(payload.storeEmail)}" style="color:#09090b;text-decoration:underline;">${escapeHtml(payload.storeEmail)}</a>` : ""}${payload.storePhone ? ` veya <strong>${escapeHtml(payload.storePhone)}</strong>` : ""} üzerinden bize ulaşabilirsiniz.</p>`
      : "";

  const html = renderEmail({
    storeName: payload.storeName,
    subject: copy.subject,
    icon: copy.icon,
    title: copy.title,
    intro: copy.intro,
    badge: copy.badge,
    blocks: [
      bankHtml,
      trackingHtml,
      infoHtml,
      itemsHtml,
      panel("Tutar Özeti", totalsRows),
      nextStepHtml,
    ],
    footer: contactHtml,
  });

  const text = renderText({
    storeName: payload.storeName,
    title: copy.title,
    lines: [
      copy.intro.replace(/<[^>]+>/g, ""),
      "",
      `Sipariş No: #${payload.orderCode}`,
      `Tarih: ${dateText}`,
      payload.paymentMethodTitle && `Ödeme Yöntemi: ${payload.paymentMethodTitle}`,
      payload.event === "order_shipped" &&
        payload.carrier &&
        `Kargo Firması: ${payload.carrier} | Takip No: ${payload.trackingNumber || "—"}`,
      payload.trackingUrl && `Takip Linki: ${payload.trackingUrl}`,
      payload.bankAccounts.length > 0 &&
        `Havale / EFT: açıklama kısmına #${payload.orderCode} yazınız.`,
      ...payload.bankAccounts.map(
        (account) => `• ${account.bankName} | ${account.accountHolder} | IBAN: ${account.iban}`
      ),
      payload.shippingAddress && `Teslimat Adresi: ${payload.shippingAddress}`,
      "",
      "Sipariş Kalemleri:",
      ...items.map(
        (item) =>
          `• ${item.title}${item.meta ? ` (${item.meta})` : ""} — ${item.quantity} adet × ${formatMoney(item.price)} = ${formatMoney(Number(item.price) * item.quantity)}`
      ),
      payload.shippingFee && payload.shippingFee > 0 ? `Kargo: +${formatMoney(payload.shippingFee)}` : "Kargo: Ücretsiz",
      payload.paymentFee ? `Kapıda Ödeme Hizmet Bedeli: +${formatMoney(payload.paymentFee)}` : null,
      "",
      `Toplam Tutar: ${formatMoney(payload.total)}`,
      "",
      `${copy.nextStepTitle}: ${copy.nextStepMessage}`,
      payload.storeEmail && `İletişim: ${payload.storeEmail}${payload.storePhone ? ` / ${payload.storePhone}` : ""}`,
    ],
  });

  return { subject: copy.subject, html, text };
}

/** Admin panelindeki şablon önizlemesi: mağaza kimliği gerçek, sipariş verisi örnek. */
export function sampleOrderPayload(event: OrderEmailEvent, store: EmailPreviewStore): OrderEmailPayload {
  return {
    event,
    orderCode: "A1B2C3D4",
    customerEmail: "musteri@example.com",
    customerName: "Ahmet Yılmaz",
    shippingAddress: "Atatürk Mah. Karanfil Sok. No: 12 D: 4, Kadıköy / İstanbul",
    total: "1250.00",
    couponCode: event === "order_placed" ? "INDIRIM10" : null,
    couponDiscountKurus: event === "order_placed" ? 1000 : null,
    createdAt: 1_700_000_000_000,
    carrier: event === "order_shipped" ? "Yurtiçi Kargo" : null,
    trackingNumber: event === "order_shipped" ? "2500012345678" : null,
    trackingUrl:
      event === "order_shipped"
        ? "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=2500012345678"
        : null,
    itemCount: 2,
    items: [
      { title: "Klasik Pamuk Gömlek", quantity: 1, price: "450.00", image: null, sku: "GOMLEK-M-BEYAZ" },
      { title: "Premium Keten Pantolon", quantity: 1, price: "800.00", image: null, sku: "PANTOLON-32-BEJ" },
    ],
    storeName: store.storeName,
    storeEmail: store.storeEmail,
    storePhone: store.storePhone,
    paymentMethod: "bank_transfer",
    paymentMethodTitle: "Havale / EFT",
    paymentFee: null,
    shippingFee: null,
    bankAccounts:
      event === "order_placed" ? store.bankAccounts : [],
    bankTransferInstructions: store.bankTransferInstructions,
  };
}
