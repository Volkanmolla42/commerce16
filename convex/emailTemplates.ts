import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { escapeHtml } from "./mailUtils";

// E-posta istemcileriyle %100 uyumlu inline SVG ikon kütüphanesi
export const EMAIL_ICONS = {
  checkCircle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  truck: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  packageCheck: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  alertCircle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  bell: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  alertTriangle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  mail: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  lock: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sparkles: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  shoppingBag: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
};

/**
 * Tüm e-postalar için merkezi temiz ve minimalist çerçeve.
 * Saçma, gereksiz dekoratif rozetler/üst başlıklar içermez.
 */
export function renderEmailContainer({
  storeName,
  iconSvg,
  title,
  contentHtml,
  footerText = `© ${storeName} — Tüm hakları saklıdır.`,
  align = "left",
}: {
  storeName: string;
  iconSvg: string;
  title: string;
  contentHtml: string;
  footerText?: string;
  align?: "left" | "center";
}): string {
  return `<div style="background-color:#fafafa;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#09090b;-webkit-font-smoothing:antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;border-collapse:separate;">
    <tr>
      <td style="padding:20px 28px;border-bottom:1px solid #f4f4f5;">
        <span style="font-size:16px;font-weight:700;letter-spacing:-0.02em;color:#09090b;">${storeName}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 28px;text-align:${align};">
        <div style="margin-bottom:14px;color:#09090b;">
          ${iconSvg}
        </div>
        <h1 style="margin:0 0 10px 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#09090b;">
          ${title}
        </h1>
        ${contentHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
        <p style="margin:0;font-size:12px;color:#71717a;">${footerText}</p>
      </td>
    </tr>
  </table>
</div>`;
}

// -------------------------------------------------------------
// MERKEZİ E-POSTA ŞABLONLARI
// -------------------------------------------------------------

export interface DefaultTemplateDef {
  key: string;
  name: string;
  category: "order" | "customer" | "marketing" | "admin";
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  sampleData: Record<string, string>;
}

export const DEFAULT_EMAIL_TEMPLATES: Record<string, DefaultTemplateDef> = {
  payment_confirmation: {
    key: "payment_confirmation",
    name: "Sipariş ve Ödeme Onayı",
    category: "order",
    description: "Müşteri ödemeyi tamamladığında otomatik olarak gönderilen detaylı sipariş özeti.",
    subject: "Siparişiniz Alındı (#{{orderNumber}}) | {{storeName}}",
    variables: [
      "{{storeName}}",
      "{{customerName}}",
      "{{orderNumber}}",
      "{{totalAmount}}",
      "{{itemsSummary}}",
      "{{shippingAddress}}",
      "{{orderDetailUrl}}",
    ],
    sampleData: {
      storeName: "Mağazamız",
      customerName: "Ahmet Yılmaz",
      orderNumber: "ORD-94821",
      totalAmount: "1.250,00 ₺",
      itemsSummary: "1x Klasik Pamuk Gömlek (M / Beyaz) - 450,00 ₺\n2x Premium Keten Pantolon (32 / Bej) - 800,00 ₺",
      shippingAddress: "Atatürk Mah. Karanfil Sok. No: 12 D: 4, Kadıköy / İstanbul",
      orderDetailUrl: "http://localhost:3000/account/orders",
    },
    bodyText: `{{storeName}} — SİPARİŞİNİZ ALINDI
----------------------------------------
Sayın {{customerName}},
Siparişiniz başarıyla onaylandı ve hazırlanmaya başlandı!

Sipariş Numarası: #{{orderNumber}}
Toplam Tutar: {{totalAmount}}

Sipariş Özeti:
{{itemsSummary}}

Teslimat Adresi:
{{shippingAddress}}

Siparişinizi görüntüleyin:
{{orderDetailUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.checkCircle,
      title: "Siparişiniz Alındı",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Merhaba <strong>{{customerName}}</strong>, siparişiniz başarıyla onaylandı. Ekibimiz siparişinizi en kısa sürede özenle hazırlamaya başlayacaktır.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Sipariş Özeti</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Sipariş No:</strong> #{{orderNumber}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Toplam Tutar:</strong> {{totalAmount}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Teslimat Adresi:</strong> {{shippingAddress}}</p>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{orderDetailUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Siparişi Görüntüle</a>
</div>`,
    }),
  },

  order_shipped: {
    key: "order_shipped",
    name: "Sipariş Kargoya Verildi",
    category: "order",
    description: "Sipariş kargo firmasına teslim edildiğinde takip numarasıyla birlikte giden e-posta.",
    subject: "Siparişiniz Kargoya Verildi (#{{orderNumber}}) | {{storeName}}",
    variables: [
      "{{storeName}}",
      "{{customerName}}",
      "{{orderNumber}}",
      "{{carrier}}",
      "{{trackingNumber}}",
      "{{trackingUrl}}",
    ],
    sampleData: {
      storeName: "Mağazamız",
      customerName: "Ahmet Yılmaz",
      orderNumber: "ORD-94821",
      carrier: "Yurtiçi Kargo",
      trackingNumber: "YK1234567890",
      trackingUrl: "https://www.yurticikargo.com/takip/YK1234567890",
    },
    bodyText: `{{storeName}} — SİPARİŞİNİZ YOLA ÇIKTI!
----------------------------------------
Sayın {{customerName}},
#{{orderNumber}} numaralı siparişiniz kargoya teslim edildi.

Kargo Firması: {{carrier}}
Takip Numarası: {{trackingNumber}}

Kargonuzu takip etmek için:
{{trackingUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.truck,
      title: "Siparişiniz Yola Çıktı",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Merhaba <strong>{{customerName}}</strong>, #{{orderNumber}} numaralı siparişiniz kargo firmasına teslim edilmiştir.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Kargo Bilgileri</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Kargo Şirketi:</strong> {{carrier}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Takip Numarası:</strong> <span style="font-family:monospace;">{{trackingNumber}}</span></p>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{trackingUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Kargomu Takip Et</a>
</div>`,
    }),
  },

  order_delivered: {
    key: "order_delivered",
    name: "Sipariş Teslim Edildi",
    category: "order",
    description: "Sipariş başarıyla müşteriye ulaştığında gönderilen teşekkür ve teslimat teyit mesajı.",
    subject: "Siparişiniz Teslim Edildi (#{{orderNumber}}) | {{storeName}}",
    variables: ["{{storeName}}", "{{customerName}}", "{{orderNumber}}", "{{storeUrl}}"],
    sampleData: {
      storeName: "Mağazamız",
      customerName: "Ahmet Yılmaz",
      orderNumber: "ORD-94821",
      storeUrl: "http://localhost:3000",
    },
    bodyText: `{{storeName}} — SİPARİŞİNİZ TESLİM EDİLDİ
----------------------------------------
Sayın {{customerName}},
#{{orderNumber}} numaralı siparişiniz başarıyla teslim edilmiştir. Ürünlerinizi güzel günlerde kullanmanızı dileriz!`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.packageCheck,
      title: "Siparişiniz Teslim Edildi",
      align: "center",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Merhaba <strong>{{customerName}}</strong>, #{{orderNumber}} numaralı siparişinizin teslimatı tamamlanmıştır. Ürünlerinizi iyi günlerde kullanmanızı dileriz.</p>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{storeUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Mağazaya Göz At</a>
</div>`,
    }),
  },

  order_cancelled: {
    key: "order_cancelled",
    name: "Sipariş İptal Bildirimi",
    category: "order",
    description: "Sipariş iptal edildiğinde ve para iadesi başlatıldığında müşteriye giden bilgilendirme.",
    subject: "Siparişiniz İptal Edildi (#{{orderNumber}}) | {{storeName}}",
    variables: ["{{storeName}}", "{{customerName}}", "{{orderNumber}}", "{{refundInfo}}"],
    sampleData: {
      storeName: "Mağazamız",
      customerName: "Ahmet Yılmaz",
      orderNumber: "ORD-94821",
      refundInfo: "Ödemeniz bankanıza bağlı olarak 1-3 iş günü içinde kartınıza iade edilecektir.",
    },
    bodyText: `{{storeName}} — SİPARİŞ İPTALİ
----------------------------------------
Sayın {{customerName}},
#{{orderNumber}} numaralı siparişiniz iptal edilmiştir.
İade Bilgisi: {{refundInfo}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.alertCircle,
      title: "Siparişiniz İptal Edildi",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Merhaba <strong>{{customerName}}</strong>, #{{orderNumber}} numaralı siparişiniz iptal edilmiştir.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:6px;">İade Bilgilendirmesi</div>
  <p style="margin:0;font-size:13px;color:#09090b;line-height:1.5;">{{refundInfo}}</p>
</div>
<p style="margin:20px 0 0 0;font-size:13px;color:#71717a;line-height:1.5;">Herhangi bir sorunuz olursa müşteri destek ekibimizle dilediğiniz an iletişime geçebilirsiniz.</p>`,
    }),
  },

  admin_new_order: {
    key: "admin_new_order",
    name: "Yönetici Yeni Sipariş Bildirimi",
    category: "admin",
    description: "Siteye yeni bir sipariş düştüğünde mağaza yöneticisine giden anlık uyarı.",
    subject: "Yeni Sipariş: #{{orderNumber}} ({{totalAmount}}) | {{storeName}}",
    variables: [
      "{{storeName}}",
      "{{orderNumber}}",
      "{{totalAmount}}",
      "{{customerName}}",
      "{{customerEmail}}",
      "{{adminOrderUrl}}",
    ],
    sampleData: {
      storeName: "Mağazamız",
      orderNumber: "ORD-94821",
      totalAmount: "1.250,00 ₺",
      customerName: "Ahmet Yılmaz",
      customerEmail: "ahmet@example.com",
      adminOrderUrl: "http://localhost:3000/admin/orders",
    },
    bodyText: `{{storeName}} — YENİ SİPARİŞ BİLDİRİMİ
----------------------------------------
Yeni bir sipariş aldınız!
Sipariş No: #{{orderNumber}}
Tutar: {{totalAmount}}
Müşteri: {{customerName}} ({{customerEmail}})

Siparişi incelemek için admin paneline gidin:
{{adminOrderUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.bell,
      title: "Yeni Sipariş Alındı",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Mağazanızdan yeni bir sipariş verildi ve ödemesi onaylandı.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Sipariş Detayı</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Sipariş No:</strong> #{{orderNumber}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Toplam Tutar:</strong> {{totalAmount}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Müşteri:</strong> {{customerName}} (<a href="mailto:{{customerEmail}}" style="color:#09090b;">{{customerEmail}}</a>)</p>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{adminOrderUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Admin Panelinde İncele</a>
</div>`,
    }),
  },

  low_stock_alert: {
    key: "low_stock_alert",
    name: "Kritik Stok Uyarısı",
    category: "admin",
    description: "Bir ürünün stoğu kritik eşiğin altına indiğinde mağaza sahibine giden uyarı.",
    subject: "Kritik Stok Uyarısı: {{productTitle}} ({{currentStock}} Adet) | {{storeName}}",
    variables: [
      "{{storeName}}",
      "{{productTitle}}",
      "{{variantTitle}}",
      "{{currentStock}}",
      "{{threshold}}",
      "{{adminInventoryUrl}}",
    ],
    sampleData: {
      storeName: "Mağazamız",
      productTitle: "Kadın Ekose Etek",
      variantTitle: "L / Kırmızı",
      currentStock: "2",
      threshold: "3",
      adminInventoryUrl: "http://localhost:3000/admin/inventory",
    },
    bodyText: `{{storeName}} — KRİTİK STOK UYARISI
----------------------------------------
Dikkat: {{productTitle}} ürününün stoğu belirlenen eşiğin altına indi!
Varyant: {{variantTitle}}
Kalan Stok: {{currentStock}} Adet (Eşik: {{threshold}})
Stok güncellemek için: {{adminInventoryUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.alertTriangle,
      title: "Kritik Stok Seviyesi",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Belirtilen ürünün stok miktarı belirlenen kritik sınırın altına düştü.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Ürün Bilgileri</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Ürün:</strong> {{productTitle}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Varyant:</strong> {{variantTitle}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Kalan Stok:</strong> <span style="font-weight:700;color:#b91c1c;">{{currentStock}} Adet</span> (Kritik Eşik: {{threshold}})</p>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{adminInventoryUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Stok Yönetimine Git</a>
</div>`,
    }),
  },

  contact_form_alert: {
    key: "contact_form_alert",
    name: "Yeni İletişim Mesajı",
    category: "admin",
    description: "İletişim formundan yeni bir mesaj gönderildiğinde yöneticiye iletilen bildirim.",
    subject: "Yeni İletişim Mesajı: {{subject}} ({{senderName}}) | {{storeName}}",
    variables: [
      "{{storeName}}",
      "{{senderName}}",
      "{{senderEmail}}",
      "{{senderPhone}}",
      "{{subject}}",
      "{{message}}",
    ],
    sampleData: {
      storeName: "Mağazamız",
      senderName: "Merve Kaya",
      senderEmail: "merve@example.com",
      senderPhone: "0532 999 88 77",
      subject: "Sipariş Teslimatı Hakkında",
      message: "Merhaba, ürünümün kargo durumunu öğrenebilir miyim? Teşekkürler.",
    },
    bodyText: `{{storeName}} — YENİ İLETİŞİM MESAJI
----------------------------------------
Gönderen: {{senderName}}
E-posta: {{senderEmail}}
Telefon: {{senderPhone}}
Konu: {{subject}}

Mesaj:
{{message}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.mail,
      title: "Yeni İletişim Mesajı",
      contentHtml: `<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Gönderen Bilgileri</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Ad Soyad:</strong> {{senderName}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>E-posta:</strong> <a href="mailto:{{senderEmail}}" style="color:#09090b;">{{senderEmail}}</a></p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Telefon:</strong> {{senderPhone}}</p>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Konu:</strong> {{subject}}</p>
</div>
<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:8px;">Mesaj</div>
<div style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:16px;font-size:13px;line-height:1.6;color:#18181b;">
  {{message}}
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="mailto:{{senderEmail}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">E-posta ile Yanıtla</a>
</div>`,
    }),
  },

  password_reset_otp: {
    key: "password_reset_otp",
    name: "Şifre Sıfırlama Kodu (OTP)",
    category: "customer",
    description: "Şifresini unutan kullanıcıya giden tek kullanımlık güvenlik kodu.",
    subject: "Şifre Sıfırlama Kodunuz: {{otpCode}} | {{storeName}}",
    variables: ["{{storeName}}", "{{otpCode}}", "{{expiryMinutes}}"],
    sampleData: {
      storeName: "Mağazamız",
      otpCode: "849201",
      expiryMinutes: "15",
    },
    bodyText: `{{storeName}} — ŞİFRE SIFIRLAMA
----------------------------------------
Tek Kullanımlık Kodunuz: {{otpCode}}
Bu kod {{expiryMinutes}} dakika geçerlidir. Kodu kimseyle paylaşmayınız.`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.lock,
      title: "Şifre Sıfırlama Kodu",
      align: "center",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Hesabınızın şifresini yenilemek için talepte bulundunuz. Aşağıdaki tek kullanımlık doğrulama kodunu ekrana giriniz:</p>
<div style="margin:20px auto;padding:14px 28px;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#09090b;display:inline-block;">
  {{otpCode}}
</div>
<p style="font-size:12px;color:#71717a;margin:16px 0 0 0;line-height:1.5;">Bu kod <strong>{{expiryMinutes}} dakika</strong> süreyle geçerlidir.<br/>Bu talebi siz yapmadıysanız lütfen bu e-postayı dikkate almayınız.</p>`,
    }),
  },

  welcome_email: {
    key: "welcome_email",
    name: "Hoş Geldin / Hesap Oluşturuldu",
    category: "customer",
    description: "Yeni üye kaydolan kullanıcıya gönderilen tebrik ve bilgilendirme mesajı.",
    subject: "{{storeName}} Ailesine Hoş Geldiniz{{customerName}}!",
    variables: ["{{storeName}}", "{{customerName}}", "{{storeUrl}}"],
    sampleData: {
      storeName: "Mağazamız",
      customerName: "Ahmet Yılmaz",
      storeUrl: "http://localhost:3000",
    },
    bodyText: `{{storeName}} — AİLEMİZE HOŞ GELDİNİZ!
----------------------------------------
Merhaba {{customerName}},
Hesabınız başarıyla oluşturuldu. Sizi aramızda görmekten mutluluk duyuyoruz!
Alışverişe başlamak için: {{storeUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.sparkles,
      title: "Aramıza Hoş Geldiniz",
      align: "center",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Merhaba <strong>{{customerName}}</strong>, hesabınız başarıyla oluşturuldu. Mağazamızda güvenli ve keyifli bir alışveriş deneyimi yaşamanız için buradayız.</p>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{storeUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Alışverişe Başla</a>
</div>`,
    }),
  },

  restock_notification: {
    key: "restock_notification",
    name: "Gelince Haber Ver (Stok Bildirimi)",
    category: "marketing",
    description: "Tükenen bir ürün tekrar stoğa girdiğinde bekleyen müşterilere giden anlık bildirim.",
    subject: "Beklediğiniz Ürün Tekrar Stokta: {{productTitle}} | {{storeName}}",
    variables: ["{{storeName}}", "{{productTitle}}", "{{productUrl}}", "{{unsubscribeUrl}}"],
    sampleData: {
      storeName: "Mağazamız",
      productTitle: "Kadın Uzun Oduncu Etek (L / Kırmızı)",
      productUrl: "http://localhost:3000/product/kadin-etek",
      unsubscribeUrl: "http://localhost:3000/restock/unsubscribe?token=sample",
    },
    bodyText: `{{storeName}} — İSTEDİĞİNİZ ÜRÜN TEKRAR STOKTA!
----------------------------------------
Beklediğiniz {{productTitle}} ürünü yeniden satışta.
Hemen inceleyin: {{productUrl}}

Bildirim almak istemiyorsanız: {{unsubscribeUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.bell,
      title: "İstediğiniz Ürün Yeniden Satışta",
      align: "center",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Takip ettiğiniz <strong>{{productTitle}}</strong> yeniden stoklarımıza girdi. Stoklar tükenmeden hemen inceleyebilirsiniz.</p>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{productUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Ürünü İncele & Satın Al</a>
</div>
<p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;"><a href="{{unsubscribeUrl}}" style="color:#71717a;text-decoration:underline;">Bildirim aboneliğinden ayrıl</a></p>`,
    }),
  },

  abandoned_cart_recovery: {
    key: "abandoned_cart_recovery",
    name: "Terk Edilmiş Sepet Hatırlatması",
    category: "marketing",
    description: "Sepetinde ürün bırakıp ayrılan kullanıcılara 1-2 saat sonra gönderilen kurtarma hatırlatması.",
    subject: "Sepetinizdeki Ürünler Sizi Bekliyor | {{storeName}}",
    variables: ["{{storeName}}", "{{itemsSummary}}", "{{restoreUrl}}", "{{unsubscribeUrl}}"],
    sampleData: {
      storeName: "Mağazamız",
      itemsSummary: "1x Kaşe Kaban - 1.450,00 ₺\n1x Deri Eldiven - 350,00 ₺",
      restoreUrl: "http://localhost:3000/cart-reminders/restore?token=sample",
      unsubscribeUrl: "http://localhost:3000/cart-reminders/unsubscribe?token=sample",
    },
    bodyText: `{{storeName}} — SEPETİNİZİ UNUTMAYIN!
----------------------------------------
Sepetinizdeki ürünler tükenmeden alışverişinizi tamamlayın:
{{itemsSummary}}

Sepetinizi geri yüklemek için: {{restoreUrl}}
E-posta listesinden çıkmak için: {{unsubscribeUrl}}`,
    bodyHtml: renderEmailContainer({
      storeName: "{{storeName}}",
      iconSvg: EMAIL_ICONS.shoppingBag,
      title: "Sepetiniz Sizi Bekliyor",
      align: "center",
      contentHtml: `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Sepetinize eklediğiniz ürünleri unutmuş olabilirsiniz. Tek tıkla sepetinize dönerek siparişinizi tamamlayabilirsiniz.</p>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="{{restoreUrl}}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Sepetime Dön ve Tamamla</a>
</div>
<p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;"><a href="{{unsubscribeUrl}}" style="color:#71717a;text-decoration:underline;">Bu hatırlatmaları almak istemiyorum</a></p>`,
    }),
  },
};

// -------------------------------------------------------------
// TÜM MAİLLER İÇİN MERKEZİ ÜRETİCİ (BUILDER) FONKSİYONLARI
// -------------------------------------------------------------

export function buildContactFormEmail(args: {
  storeName: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string | null;
  subject: string;
  message: string;
  formattedDate: string;
}) {
  const contentHtml = `<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Gönderen Bilgileri</div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;">
    <tr>
      <td style="width:90px;color:#71717a;padding:3px 0;">Ad Soyad:</td>
      <td style="color:#09090b;font-weight:600;padding:3px 0;">${escapeHtml(args.senderName)}</td>
    </tr>
    <tr>
      <td style="color:#71717a;padding:3px 0;">E-posta:</td>
      <td style="padding:3px 0;">
        <a href="mailto:${escapeHtml(args.senderEmail)}" style="color:#09090b;font-weight:600;text-decoration:none;">
          ${escapeHtml(args.senderEmail)}
        </a>
      </td>
    </tr>
    ${args.senderPhone ? `
    <tr>
      <td style="color:#71717a;padding:3px 0;">Telefon:</td>
      <td style="color:#09090b;padding:3px 0;">${escapeHtml(args.senderPhone)}</td>
    </tr>
    ` : ""}
    <tr>
      <td style="color:#71717a;padding:3px 0;">Konu:</td>
      <td style="color:#09090b;padding:3px 0;">${escapeHtml(args.subject)}</td>
    </tr>
  </table>
</div>
<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#71717a;margin-bottom:8px;letter-spacing:0.05em;">Mesaj İçeriği:</div>
<div style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:16px;font-size:13px;color:#18181b;line-height:1.6;white-space:pre-wrap;margin-bottom:20px;">${escapeHtml(args.message)}</div>
<div style="text-align:center;margin:24px 0 16px 0;">
  <a href="mailto:${escapeHtml(args.senderEmail)}" style="display:inline-block;padding:11px 26px;background-color:#09090b;color:#ffffff !important;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;letter-spacing:-0.01em;">
    E-posta ile Yanıtla
  </a>
</div>
<p style="margin:0;font-size:12px;color:#71717a;text-align:center;line-height:1.4;">
  Bu e-postayı doğrudan yanıtlayarak da müşteriye dönüş yapabilirsiniz.
</p>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.mail,
    title: "Yeni İletişim Mesajı",
    contentHtml,
  });
}

export function buildPasswordResetEmail(args: {
  storeName: string;
  token: string;
}) {
  const contentHtml = `<p style="margin:0 0 20px 0;font-size:14px;color:#52525b;line-height:1.6;max-width:440px;margin-left:auto;margin-right:auto;">
  Hesabınızın şifresini yenilemek için talepte bulundunuz. Aşağıdaki tek kullanımlık doğrulama kodunu ekrandaki alana giriniz:
</p>
<div style="margin:20px auto;padding:14px 28px;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#09090b;display:inline-block;">
  ${escapeHtml(args.token)}
</div>
<p style="margin:16px 0 0 0;font-size:12px;color:#71717a;line-height:1.5;">
  Bu kod güvenliğiniz için <strong>sınırlı süreyle</strong> geçerlidir.<br />
  Lütfen bu kodu kimseyle paylaşmayınız.
</p>
<div style="margin-top:24px;background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:12px 16px;text-align:left;">
  <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
    Bu talebi siz gerçekleştirmediyseniz, hiçbir işlem yapmanıza gerek yoktur. Hesabınız güvendedir.
  </p>
</div>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.lock,
    title: "Şifre Sıfırlama Kodu",
    align: "center",
    contentHtml,
  });
}

export function buildWelcomeEmail(args: {
  storeName: string;
  userName?: string | null;
  siteUrl: string;
}) {
  const greetingName = args.userName ? ` <strong>${escapeHtml(args.userName)}</strong>` : "";
  const contentHtml = `<p style="margin:0 0 20px 0;font-size:14px;color:#52525b;line-height:1.6;max-width:440px;margin-left:auto;margin-right:auto;">
  Merhaba${greetingName}, hesabınız başarıyla oluşturuldu. Mağazamızda güvenli ve keyifli bir alışveriş deneyimi yaşamanız için buradayız.
</p>
<div style="text-align:center;margin:28px 0 20px 0;">
  <a href="${escapeHtml(args.siteUrl)}" 
     style="display:inline-block;background-color:#09090b;color:#ffffff !important;font-size:13px;font-weight:600;text-decoration:none;padding:11px 28px;border-radius:8px;letter-spacing:-0.01em;">
    Alışverişe Başla
  </a>
</div>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.sparkles,
    title: "Aramıza Hoş Geldiniz",
    align: "center",
    contentHtml,
  });
}

export function buildLowStockAlertEmail(args: {
  storeName: string;
  productTitle: string;
  variantTitle?: string | null;
  currentStock: number;
  threshold: number;
  adminInventoryUrl: string;
}) {
  const contentHtml = `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Belirtilen ürünün stok miktarı belirlenen kritik sınırın altına düştü.</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:18px 20px;margin:20px 0;">
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;margin-bottom:10px;">Ürün Bilgileri</div>
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Ürün:</strong> ${escapeHtml(args.productTitle)}</p>
  ${args.variantTitle ? `<p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Varyant:</strong> ${escapeHtml(args.variantTitle)}</p>` : ""}
  <p style="margin:4px 0;font-size:13px;color:#09090b;"><strong>Kalan Stok:</strong> <span style="font-weight:700;color:#b91c1c;">${args.currentStock} Adet</span> (Kritik Eşik: ${args.threshold})</p>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="${escapeHtml(args.adminInventoryUrl)}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Stok Yönetimine Git</a>
</div>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.alertTriangle,
    title: "Kritik Stok Seviyesi",
    contentHtml,
  });
}

export function buildAbandonedCartRecoveryEmail(args: {
  storeName: string;
  itemsHtml: string;
  totalText: string;
  cartUrl: string;
  unsubscribeUrl: string;
}) {
  const contentHtml = `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;">Sepetinize eklediğiniz harika ürünleri unutmuş olabilirsiniz. Siparişinizi kolayca tamamlayabilirsiniz:</p>
<div style="background-color:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
  ${args.itemsHtml}
  <div style="border-top:1px solid #e4e4e7;padding-top:10px;margin-top:10px;text-align:right;font-size:14px;font-weight:700;color:#09090b;">
    Tahmini Toplam: ${escapeHtml(args.totalText)}
  </div>
</div>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="${escapeHtml(args.cartUrl)}" style="background-color:#09090b;color:#ffffff !important;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Sepetime Dön ve Tamamla</a>
</div>
<p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;text-align:center;"><a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Bu hatırlatmaları almak istemiyorum</a></p>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.shoppingBag,
    title: "Sepetiniz Sizi Bekliyor",
    contentHtml,
  });
}

export function buildRestockNotificationEmail(args: {
  storeName: string;
  productTitle: string;
  productUrl: string;
  unsubscribeUrl: string;
}) {
  const contentHtml = `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#52525b;max-width:440px;margin-left:auto;margin-right:auto;">Takip ettiğiniz <strong>${escapeHtml(args.productTitle)}</strong> yeniden stoklarımıza girdi. Stoklar tükenmeden hemen inceleyebilirsiniz.</p>
<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="${escapeHtml(args.productUrl)}" style="background-color:#09090b;color:#ffffff !important;padding:11px 26px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:-0.01em;display:inline-block;">Ürünü İncele & Satın Al</a>
</div>
<p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;"><a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Bildirim aboneliğinden ayrıl</a></p>`;

  return renderEmailContainer({
    storeName: escapeHtml(args.storeName),
    iconSvg: EMAIL_ICONS.bell,
    title: "İstediğiniz Ürün Yeniden Satışta",
    align: "center",
    contentHtml,
  });
}

// -------------------------------------------------------------
// MOTOR VE SORGULAR (CONVEX FUNCTIONS)
// -------------------------------------------------------------

// Değişkenleri dinamik olarak değiştiren motor
export function renderTemplate(
  template: { subject: string; bodyHtml: string; bodyText: string },
  values: Record<string, string | number | undefined | null>
) {
  let renderedSubject = template.subject;
  let renderedHtml = template.bodyHtml;
  let renderedText = template.bodyText;

  for (const [key, val] of Object.entries(values)) {
    const stringVal = val !== undefined && val !== null ? String(val) : "";
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    renderedSubject = renderedSubject.replace(regex, stringVal);
    renderedHtml = renderedHtml.replace(regex, stringVal);
    renderedText = renderedText.replace(regex, stringVal);
  }

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
}

// 1. Şablon getirme: Doğrudan codebase'deki şablon tanımını döner
export const getActiveTemplate = internalQuery({
  args: {
    key: v.string(),
  },
  handler: async (_ctx, args) => {
    const defaultTpl = DEFAULT_EMAIL_TEMPLATES[args.key];
    if (defaultTpl) {
      return {
        key: defaultTpl.key,
        name: defaultTpl.name,
        subject: defaultTpl.subject,
        bodyHtml: defaultTpl.bodyHtml,
        bodyText: defaultTpl.bodyText,
        variables: defaultTpl.variables,
      };
    }
    return null;
  },
});

// 2. Admin için şablonları listeleme
export const listTemplatesAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (_ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    return Object.values(DEFAULT_EMAIL_TEMPLATES).map((tpl) => ({
      key: tpl.key,
      name: tpl.name,
      category: tpl.category,
      description: tpl.description,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      bodyText: tpl.bodyText,
      variables: tpl.variables,
      sampleData: tpl.sampleData,
    }));
  },
});

// 3. Admin şablon mock veriyle canlı önizleme
export const previewTemplateAdmin = query({
  args: {
    adminSecret: v.string(),
    key: v.string(),
  },
  handler: async (_ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const defaultTpl = DEFAULT_EMAIL_TEMPLATES[args.key];
    if (!defaultTpl) throw new Error("Şablon bulunamadı.");

    const rendered = renderTemplate(
      { subject: defaultTpl.subject, bodyHtml: defaultTpl.bodyHtml, bodyText: defaultTpl.bodyText },
      defaultTpl.sampleData
    );

    return {
      key: defaultTpl.key,
      name: defaultTpl.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      sampleData: defaultTpl.sampleData,
      variables: defaultTpl.variables,
    };
  },
});

// 4. Merkezi e-posta loglama
export const recordEmailLog = internalMutation({
  args: {
    templateKey: v.string(),
    recipient: v.string(),
    subject: v.string(),
    htmlBody: v.optional(v.string()),
    textBody: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", {
      templateKey: args.templateKey,
      recipient: args.recipient,
      subject: args.subject,
      htmlBody: args.htmlBody,
      textBody: args.textBody,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    return null;
  },
});
