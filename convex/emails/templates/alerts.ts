import { formatDateTime } from "../../../lib/format-date";
import { formatPhone } from "../../../lib/orders";
import { escapeHtml } from "../../../lib/html";
import {
  cta,
  field,
  fieldTable,
  ICONS,
  panel,
  renderEmail,
  renderText,
  type EmailContent,
} from "../content";

export interface ContactEmailData {
  storeName: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  messageSubject: string;
  message: string;
  _creationTime: number;
}

export function renderContactEmail(data: ContactEmailData): EmailContent {
  const subject = `Yeni İletişim Mesajı: ${data.messageSubject} (${data.senderName}) | ${data.storeName}`;
  const dateText = formatDateTime(data._creationTime, { dateStyle: "full", timeStyle: "short" });

  const senderRows = [
    field("Ad Soyad", `<strong>${escapeHtml(data.senderName)}</strong>`),
    field("E-posta", `<a href="mailto:${escapeHtml(data.senderEmail)}" style="color:#09090b;font-weight:600;text-decoration:none;">${escapeHtml(data.senderEmail)}</a>`),
    data.senderPhone ? field("Telefon", escapeHtml(formatPhone(data.senderPhone))) : "",
    field("Konu", escapeHtml(data.messageSubject)),
    field("Tarih", escapeHtml(dateText)),
  ];

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.mail,
    title: "Yeni İletişim Mesajı",
    intro: `Mağaza iletişim formundan size yeni bir mesaj geldi.`,
    badge: { text: "İletişim", tone: "accent" },
    blocks: [
      panel("Gönderen Bilgileri", fieldTable(senderRows)),
      panel(
        "Mesaj İçeriği",
        `<div style="font-size:13px;color:#18181b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</div>`
      ),
      cta(`mailto:${escapeHtml(data.senderEmail)}`, "E-posta ile Yanıtla"),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: "Yeni İletişim Mesajı",
    lines: [
      `Tarih: ${dateText}`,
      `Gönderen: ${data.senderName}`,
      `E-posta: ${data.senderEmail}`,
      data.senderPhone && `Telefon: ${formatPhone(data.senderPhone)}`,
      `Konu: ${data.messageSubject}`,
      "",
      "Mesaj:",
      data.message,
      "",
      "Bu e-postayı yanıtlayarak müşteriye geri dönebilirsiniz.",
    ],
  });

  return { subject, html, text };
}

export interface LowStockEmailData {
  storeName: string;
  productTitle: string;
  variantTitle: string | null;
  currentStock: number;
  threshold: number;
  adminInventoryUrl: string;
}

export function renderLowStockEmail(data: LowStockEmailData): EmailContent {
  const subject = `Kritik Stok: ${data.productTitle} (son ${data.currentStock} adet)`;

  const rows = [
    field("Ürün", `<strong>${escapeHtml(data.productTitle)}</strong>`),
    data.variantTitle ? field("Varyant", escapeHtml(data.variantTitle)) : "",
    field(
      "Kalan Stok",
      `<strong style="color:#dc2626;">${data.currentStock} adet</strong> (Kritik eşik: ${data.threshold})`
    ),
  ];

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.alertTriangle,
    title: "Kritik Stok Seviyesi",
    intro: "Belirtilen ürünün stoğu kritik eşiğin altına düştü.",
    badge: { text: "Stok Uyarısı", tone: "danger" },
    blocks: [panel("Ürün Bilgileri", fieldTable(rows)), cta(data.adminInventoryUrl, "Stok Yönetimine Git")],
  });

  const text = renderText({
    storeName: data.storeName,
    title: "Kritik Stok Uyarısı",
    lines: [
      `${data.productTitle}${data.variantTitle ? ` (${data.variantTitle})` : ""} ürününün stoğu kritik eşiğin altına indi.`,
      "",
      `Kalan stok: ${data.currentStock} adet | Kritik eşik: ${data.threshold} adet`,
      "",
      `Stok güncellemek için: ${data.adminInventoryUrl}`,
    ],
  });

  return { subject, html, text };
}

export interface ProductQuestionEmailData {
  storeName: string;
  productTitle: string | null;
  productUrl: string;
  user: { name: string; email: string | null };
  question: string;
  _creationTime: number;
  adminQuestionsUrl: string;
}

export function renderProductQuestionEmail(data: ProductQuestionEmailData): EmailContent {
  const productTitle = data.productTitle ?? "Ürün silinmiş";
  const subject = `Yeni Ürün Sorusu: ${productTitle} (${data.user.name}) | ${data.storeName}`;
  const dateText = formatDateTime(data._creationTime, { dateStyle: "full", timeStyle: "short" });

  const rows = [
    field("Ürün", `<strong>${escapeHtml(productTitle)}</strong>`),
    field("Müşteri", escapeHtml(data.user.name)),
    data.user.email
      ? field("E-posta", `<a href="mailto:${escapeHtml(data.user.email)}" style="color:#09090b;font-weight:600;text-decoration:none;">${escapeHtml(data.user.email)}</a>`)
      : "",
    field("Tarih", escapeHtml(dateText)),
  ];

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.mail,
    title: "Yeni Ürün Sorusu",
    intro: "Ürün sayfasından yeni bir soru geldi. Yanıtladığınızda soru otomatik olarak yayınlanır.",
    badge: { text: "Soru Cevap", tone: "warning" },
    blocks: [
      panel("Soru Bilgileri", fieldTable(rows)),
      panel(
        "Soru",
        `<div style="font-size:13px;color:#18181b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.question)}</div>`
      ),
      data.productUrl ? cta(data.productUrl, "Ürünü Görüntüle") : "",
      cta(data.adminQuestionsUrl, "Soruları Yönet"),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: "Yeni Ürün Sorusu",
    lines: [
      `Ürün: ${productTitle}`,
      `Müşteri: ${data.user.name}`,
      data.user.email ? `E-posta: ${data.user.email}` : "",
      `Tarih: ${dateText}`,
      "",
      "Soru:",
      data.question,
      "",
      `Soruları yönetmek için: ${data.adminQuestionsUrl}`,
    ],
  });

  return { subject, html, text };
}
