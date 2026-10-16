import { formatMoney } from "../../../lib/format-money";
import { escapeHtml } from "../../../lib/html";
import {
  cta,
  field,
  fieldTable,
  ICONS,
  itemRows,
  linkLine,
  panel,
  renderEmail,
  renderText,
  type EmailContent,
  type EmailLineItem,
} from "../content";

export interface CartRecoveryEmailData {
  storeName: string;
  items: EmailLineItem[];
  cartUrl: string;
  unsubscribeUrl: string;
}

export function renderCartRecoveryEmail(data: CartRecoveryEmailData): EmailContent {
  const subject = `Sepetinizde ürünler kaldı | ${data.storeName}`;
  const total = data.items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const totalText = formatMoney(total);

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.shoppingBag,
    title: "Sepetiniz Sizi Bekliyor",
    intro: "Sepetinize eklediğiniz ürünler sizi bekliyor; siparişinizi kolayca tamamlayabilirsiniz.",
    badge: { text: "Sepet Hatırlatması", tone: "warning" },
    blocks: [
      panel(
        "Sepetinizdeki Ürünler",
        `<table cellpadding="0" cellspacing="0" border="0" width="100%">${itemRows(data.items)}</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
  <td style="padding-top:10px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;">Tahmini toplam</td>
  <td style="padding-top:10px;border-top:1px solid #e4e4e7;text-align:right;font-size:14px;font-weight:700;color:#09090b;">${escapeHtml(totalText)}</td>
</tr></table>`
      ),
      cta(data.cartUrl, "Sepetime Dön ve Tamamla"),
      linkLine(data.unsubscribeUrl, "Bu hatırlatmaları almak istemiyorum"),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: "Sepetiniz Sizi Bekliyor",
    lines: [
      "Sepetinizde bıraktığınız ürünler tükenmeden alışverişinizi tamamlayabilirsiniz.",
      "",
      "Sepetinizdeki ürünler:",
      ...data.items.map(
        (item) =>
          `• ${item.title}${item.meta ? ` (${item.meta})` : ""} — ${item.quantity} adet × ${formatMoney(item.price)}`
      ),
      "",
      `Tahmini toplam: ${totalText}`,
      "",
      `Sepete dön: ${data.cartUrl}`,
      "",
      `Hatırlatmaları kapatmak için: ${data.unsubscribeUrl}`,
    ],
  });

  return { subject, html, text };
}

export interface RestockEmailData {
  storeName: string;
  productTitle: string;
  variantTitle: string | null;
  price: string;
  productUrl: string;
  unsubscribeUrl: string;
}

export function renderRestockEmail(data: RestockEmailData): EmailContent {
  const subject = `${data.productTitle} yeniden stokta | ${data.storeName}`;

  const rows = [
    field("Ürün", `<strong>${escapeHtml(data.productTitle)}</strong>`),
    data.variantTitle ? field("Seçenek", escapeHtml(data.variantTitle)) : "",
    field("Fiyat", escapeHtml(formatMoney(data.price))),
  ];

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.bell,
    title: "İstediğiniz Ürün Yeniden Satışta",
    intro: `Takip ettiğiniz <strong>${escapeHtml(data.productTitle)}</strong> yeniden stoklarımıza girdi. Stoklar tükenmeden hemen inceleyebilirsiniz.`,
    badge: { text: "Stokta", tone: "success" },
    align: "center",
    blocks: [
      panel("Ürün Bilgileri", fieldTable(rows)),
      cta(data.productUrl, "Ürünü İncele"),
      linkLine(data.unsubscribeUrl, "Bildirim aboneliğinden ayrıl"),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: "Yeniden Stokta",
    lines: [
      `Beklediğiniz ürün tekrar stoklarımıza girdi.`,
      "",
      `Ürün: ${data.productTitle}${data.variantTitle ? ` (${data.variantTitle})` : ""}`,
      `Fiyat: ${formatMoney(data.price)}`,
      "",
      `İncelemek için: ${data.productUrl}`,
      "",
      `Artık bildirim almak istemiyorsanız: ${data.unsubscribeUrl}`,
    ],
  });

  return { subject, html, text };
}
