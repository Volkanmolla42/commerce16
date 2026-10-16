import type { EmailContent } from "./content";
import { adminLink, siteLink, siteUrl } from "./config";
import { renderContactEmail, renderLowStockEmail } from "./templates/alerts";
import { renderOtpEmail, renderWelcomeEmail } from "./templates/account";
import { renderCartRecoveryEmail, renderRestockEmail } from "./templates/marketing";
import { renderOrderEmail, sampleOrderPayload } from "./templates/order";

export type EmailTemplateKey =
  | "order_placed"
  | "payment_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "admin_order_alert"
  | "welcome_email"
  | "password_reset_otp"
  | "password_change_otp"
  | "contact_form_alert"
  | "low_stock_alert"
  | "abandoned_cart_recovery"
  | "restock_notification";

export type EmailCategory = "order" | "customer" | "marketing" | "admin";

/**
 * Önizlemeler mağazanın gerçek kimliğiyle üretilir (ad, iletişim, banka, eşik);
 * müşteri ve ürün satırları örnek veri olarak kalır.
 */
export interface EmailPreviewStore {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  lowStockThreshold: number;
  bankAccounts: Array<{ bankName: string; accountHolder: string; iban: string }>;
  bankTransferInstructions: string;
}

interface TemplateMeta {
  key: EmailTemplateKey;
  name: string;
  category: EmailCategory;
  description: string;
  /** Müşteriye gidenin aynısı: gerçek şablon, mağaza kimliği ve örnek veriyle çalıştırılır. */
  preview: (store: EmailPreviewStore) => EmailContent;
}

export const EMAIL_TEMPLATES: TemplateMeta[] = [
  {
    key: "order_placed",
    name: "Sipariş Alındı",
    category: "order",
    description: "Sipariş oluşturulduğunda müşteriye gider; ödeme yönteminin sonraki adımını içerir.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("order_placed", store)),
  },
  {
    key: "payment_confirmed",
    name: "Ödeme Onaylandı",
    category: "order",
    description: "Sipariş ödendi olarak işaretlendiğinde müşteriye gider.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("payment_confirmed", store)),
  },
  {
    key: "order_shipped",
    name: "Kargoya Verildi",
    category: "order",
    description: "Kargo firması ve takip numarasıyla birlikte müşteriye gider.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("order_shipped", store)),
  },
  {
    key: "order_delivered",
    name: "Teslim Edildi",
    category: "order",
    description: "Paket alıcıya ulaştığında müşteriye gider.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("order_delivered", store)),
  },
  {
    key: "order_cancelled",
    name: "Sipariş İptal Edildi",
    category: "order",
    description: "Sipariş iptal edildiğinde müşteriye gider.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("order_cancelled", store)),
  },
  {
    key: "admin_order_alert",
    name: "Yeni Sipariş Bildirimi",
    category: "admin",
    description: "Yeni sipariş oluştuğunda ADMIN_ALERT_EMAIL adresine gider.",
    preview: (store) => renderOrderEmail(sampleOrderPayload("admin_order_alert", store)),
  },
  {
    key: "welcome_email",
    name: "Hoş Geldiniz",
    category: "customer",
    description: "Hesap oluşturulduğunda yeni müşteriye gider.",
    preview: (store) => renderWelcomeEmail({ storeName: store.storeName, userName: "Ahmet Yılmaz", siteUrl: siteUrl() }),
  },
  {
    key: "password_reset_otp",
    name: "Şifre Sıfırlama Kodu",
    category: "customer",
    description: "Giriş ekranından şifre sıfırlama talep edildiğinde gider.",
    preview: (store) => renderOtpEmail({ storeName: store.storeName, token: "482913", purpose: "reset" }),
  },
  {
    key: "password_change_otp",
    name: "Şifre Değiştirme Kodu",
    category: "customer",
    description: "Hesap ayarlarından şifre değiştirilirken doğrulama kodu olarak gider.",
    preview: (store) => renderOtpEmail({ storeName: store.storeName, token: "482913", purpose: "change" }),
  },
  {
    key: "contact_form_alert",
    name: "İletişim Mesajı",
    category: "admin",
    description: "İletişim formundan gelen mesaj ADMIN_ALERT_EMAIL adresine iletilir.",
    preview: (store) =>
      renderContactEmail({
        storeName: store.storeName,
        senderName: "Ayşe Demir",
        senderEmail: "ayse@example.com",
        senderPhone: "5321234567",
        messageSubject: "Kargo süresi",
        message: "Merhaba, siparişim kaç günde kargoya veriliyor?",
        createdAt: 1_700_000_000_000,
      }),
  },
  {
    key: "low_stock_alert",
    name: "Kritik Stok Uyarısı",
    category: "admin",
    description: "Stok kritik eşiğin altına indiğinde yöneticiye gider.",
    preview: (store) =>
      renderLowStockEmail({
        storeName: store.storeName,
        productTitle: "Klasik Pamuk Gömlek",
        variantTitle: "Beden: M / Beyaz",
        currentStock: Math.max(0, store.lowStockThreshold - 1),
        threshold: store.lowStockThreshold,
        adminInventoryUrl: adminLink("inventory"),
      }),
  },
  {
    key: "abandoned_cart_recovery",
    name: "Sepet Hatırlatması",
    category: "marketing",
    description: "Açık kalan sepetler için abone olan müşteriye 1 saat sonra gider.",
    preview: (store) =>
      renderCartRecoveryEmail({
        storeName: store.storeName,
        items: [
          { title: "Klasik Pamuk Gömlek", quantity: 1, price: "450.00", meta: "Beden: M / Beyaz" },
          { title: "Premium Keten Pantolon", quantity: 1, price: "800.00", meta: "Beden: 32 / Bej" },
        ],
        cartUrl: siteLink("/cart"),
        unsubscribeUrl: siteLink("/cart-reminders/unsubscribe"),
      }),
  },
  {
    key: "restock_notification",
    name: "Yeniden Stokta Bildirimi",
    category: "marketing",
    description: "Ürün stoklara döndüğünde bildirim abonelerine gider.",
    preview: (store) =>
      renderRestockEmail({
        storeName: store.storeName,
        productTitle: "Klasik Pamuk Gömlek",
        variantTitle: "Beden: M / Beyaz",
        price: "450.00",
        productUrl: siteLink("/product/klasik-pamuk-gomlek"),
        unsubscribeUrl: siteLink("/restock/unsubscribe"),
      }),
  },
];
