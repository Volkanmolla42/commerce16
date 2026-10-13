import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";

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

Siparişinizin durumunu dilediğiniz an takip edebilirsiniz:
{{orderDetailUrl}}

Bizi tercih ettiğiniz için teşekkür ederiz!`,
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Siparişiniz Alındı</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">#{{orderNumber}} — {{storeName}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">Merhaba <strong>{{customerName}}</strong>,</p>
    <p style="color: #475569; line-height: 1.6;">Siparişiniz başarıyla alındı ve ödemeniz onaylandı. Ekibimiz siparişinizi en kısa sürede özenle hazırlayıp kargoya verecektir.</p>
    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #64748b;">Sipariş Bilgileri</h3>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Toplam Tutar:</strong> {{totalAmount}}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Teslimat Adresi:</strong> {{shippingAddress}}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{orderDetailUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Siparişimi Görüntüle</a>
    </div>
  </div>
</div>`,
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Siparişiniz Yola Çıktı 🚚</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">#{{orderNumber}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">Merhaba <strong>{{customerName}}</strong>,</p>
    <p style="color: #475569; line-height: 1.6;">Siparişiniz kargo firmasına teslim edildi. Aşağıdaki takip bağlantısı ile kargonuzun nerede olduğunu anlık olarak takip edebilirsiniz.</p>
    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Kargo Firması:</strong> {{carrier}}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Takip Kodu:</strong> {{trackingNumber}}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{trackingUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Kargomu Takip Et</a>
    </div>
  </div>
</div>`,
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Teslimat Tamamlandı ✨</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">#{{orderNumber}}</p>
  </div>
  <div style="padding: 32px; text-align: center;">
    <p style="font-size: 16px;">Merhaba <strong>{{customerName}}</strong>,</p>
    <p style="color: #475569; line-height: 1.6;">Siparişiniz başarıyla teslim edildi. Umarız ürünlerimizden memnun kalırsınız!</p>
    <div style="margin: 32px 0;">
      <a href="{{storeUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Mağazaya Göz At</a>
    </div>
  </div>
</div>`,
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Sipariş İptal Edildi</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">#{{orderNumber}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px;">Merhaba <strong>{{customerName}}</strong>,</p>
    <p style="color: #475569; line-height: 1.6;">#{{orderNumber}} numaralı siparişiniz iptal edilmiştir.</p>
    <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fecaca; color: #991b1b; font-size: 14px;">
      {{refundInfo}}
    </div>
  </div>
</div>`,
  },

  admin_new_order: {
    key: "admin_new_order",
    name: "Yönetici Yeni Sipariş Bildirimi",
    category: "admin",
    description: "Siteye yeni bir sipariş düştüğünde mağaza yöneticisine giden anlık uyarı.",
    subject: "🚨 Yeni Sipariş: #{{orderNumber}} ({{totalAmount}}) | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Yeni Sipariş Geldi 🎉</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">#{{orderNumber}} — {{totalAmount}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 15px;"><strong>Müşteri:</strong> {{customerName}} ({{customerEmail}})</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{adminOrderUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Admin Panelinde Görüntüle</a>
    </div>
  </div>
</div>`,
  },

  low_stock_alert: {
    key: "low_stock_alert",
    name: "Kritik Stok Uyarısı",
    category: "admin",
    description: "Bir ürünün stoğu kritik eşiğin altına indiğinde mağaza sahibine giden uyarı.",
    subject: "⚠️ Kritik Stok Uyarısı: {{productTitle}} ({{currentStock}} Adet Kaldı) | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #dc2626; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Kritik Stok Uyarısı ⚠️</h1>
    <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px;">{{productTitle}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 15px;"><strong>Seçenek:</strong> {{variantTitle}}</p>
    <p style="font-size: 15px;"><strong>Kalan Stok:</strong> <span style="color: #dc2626; font-weight: bold;">{{currentStock}} Adet</span> (Kritik Eşik: {{threshold}})</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{adminInventoryUrl}}" style="background: #0f172a; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Stok Yönetimine Git</a>
    </div>
  </div>
</div>`,
  },

  contact_form_alert: {
    key: "contact_form_alert",
    name: "Yeni İletişim Mesajı",
    category: "admin",
    description: "İletişim formundan yeni bir mesaj gönderildiğinde yöneticiye iletilen bildirim.",
    subject: "📩 Yeni İletişim Mesajı: {{subject}} ({{senderName}}) | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b;">
  <div style="background: #0f172a; padding: 32px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Yeni İletişim Mesajı 📩</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">{{subject}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 14px; margin: 4px 0;"><strong>Gönderen:</strong> {{senderName}}</p>
    <p style="font-size: 14px; margin: 4px 0;"><strong>E-posta:</strong> {{senderEmail}}</p>
    <p style="font-size: 14px; margin: 4px 0;"><strong>Telefon:</strong> {{senderPhone}}</p>
    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 6px; font-size: 14px; line-height: 1.6;">
      {{message}}
    </div>
  </div>
</div>`,
  },

  password_reset_otp: {
    key: "password_reset_otp",
    name: "Şifre Sıfırlama Kodu (OTP)",
    category: "customer",
    description: "Şifresini unutan kullanıcıya giden tek kullanımlık güvenlik kodu.",
    subject: "🔐 Şifre Sıfırlama Kodunuz: {{otpCode}} | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b; text-align: center;">
  <div style="background: #0f172a; padding: 32px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Şifre Sıfırlama Kodu</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">{{storeName}}</p>
  </div>
  <div style="padding: 32px;">
    <p style="color: #475569; font-size: 15px;">Aşağıdaki tek kullanımlık doğrulama kodunu şifre yenileme ekranına giriniz:</p>
    <div style="margin: 24px auto; padding: 16px 28px; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 6px; font-family: monospace; display: inline-block;">
      {{otpCode}}
    </div>
    <p style="font-size: 13px; color: #64748b;">Bu kod {{expiryMinutes}} dakika süreyle geçerlidir.</p>
  </div>
</div>`,
  },

  welcome_email: {
    key: "welcome_email",
    name: "Hoş Geldin / Hesap Oluşturuldu",
    category: "customer",
    description: "Yeni üye kaydolan kullanıcıya gönderilen tebrik ve bilgilendirme mesajı.",
    subject: "✨ {{storeName}}'a Hoş Geldiniz{{customerName}}!",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b; text-align: center;">
  <div style="background: #0f172a; padding: 36px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px;">Ailemize Hoş Geldiniz ✨</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">{{storeName}}</p>
  </div>
  <div style="padding: 36px;">
    <p style="font-size: 16px; color: #334155;">Merhaba <strong>{{customerName}}</strong>,</p>
    <p style="color: #64748b; line-height: 1.6;">Hesabınız başarıyla oluşturuldu. Artık siparişlerinizi kolayca takip edebilir, adreslerinizi kaydedebilir ve favori ürünlerinizi saklayabilirsiniz.</p>
    <div style="margin: 32px 0;">
      <a href="{{storeUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Alışverişe Başla</a>
    </div>
  </div>
</div>`,
  },

  restock_notification: {
    key: "restock_notification",
    name: "Gelince Haber Ver (Stok Bildirimi)",
    category: "marketing",
    description: "Tükenen bir ürün tekrar stoğa girdiğinde bekleyen müşterilere giden anlık bildirim.",
    subject: "🎉 Müjde: {{productTitle}} Tekrar Stokta! | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b; text-align: center;">
  <div style="background: #0f172a; padding: 36px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">İstediğiniz Ürün Tekrar Stokta! 🎉</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">{{storeName}}</p>
  </div>
  <div style="padding: 36px;">
    <p style="font-size: 16px; color: #334155;">Beklediğiniz <strong>{{productTitle}}</strong> yeniden satışta! Stoklar tükenmeden hemen sipariş verebilirsiniz.</p>
    <div style="margin: 32px 0;">
      <a href="{{productUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Ürünü İncele & Satın Al</a>
    </div>
    <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;"><a href="{{unsubscribeUrl}}" style="color: #64748b;">Bildirim aboneliğinden ayrıl</a></p>
  </div>
</div>`,
  },

  abandoned_cart_recovery: {
    key: "abandoned_cart_recovery",
    name: "Terk Edilmiş Sepet Hatırlatması",
    category: "marketing",
    description: "Sepetinde ürün bırakıp ayrılan kullanıcılara 1-2 saat sonra gönderilen kurtarma hatırlatması.",
    subject: "Sepetinizdeki Ürünler Sizi Bekliyor! | {{storeName}}",
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
    bodyHtml: `<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; font-family: sans-serif; color: #1e293b; text-align: center;">
  <div style="background: #0f172a; padding: 36px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 22px;">Sepetiniz Sizi Bekliyor 🛒</h1>
    <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">{{storeName}}</p>
  </div>
  <div style="padding: 36px;">
    <p style="font-size: 15px; color: #475569;">Sepetinize eklediğiniz harika ürünleri unutmuş olabilirsiniz. Tek tıkla sepetinizi geri yükleyip alışverişinizi tamamlayabilirsiniz.</p>
    <div style="margin: 32px 0;">
      <a href="{{restoreUrl}}" style="background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Sepetime Dön ve Tamamla</a>
    </div>
    <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;"><a href="{{unsubscribeUrl}}" style="color: #64748b;">Bu hatırlatmaları almak istemiyorum</a></p>
  </div>
</div>`,
  },
};

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
        isCustomized: false,
      };
    }
    return null;
  },
});

// 2. Admin için codebase'de tanımlı tüm e-posta şablonlarını ve mock verilerini listeleme
export const listTemplatesAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (_ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    return Object.values(DEFAULT_EMAIL_TEMPLATES).map((def) => ({
      key: def.key,
      name: def.name,
      category: def.category,
      description: def.description,
      subject: def.subject,
      bodyHtml: def.bodyHtml,
      bodyText: def.bodyText,
      variables: def.variables,
      sampleData: def.sampleData,
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
