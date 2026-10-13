export const orderStatusLabels = {
  pending: "Beklemede",
  paid: "Ödendi",
  shipped: "Kargoya verildi",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
} as const;

export type OrderStatus = keyof typeof orderStatusLabels;

export const paymentMethodLabels: Record<string, string> = {
  paytr: "PayTR (Demo)",
  bank_transfer: "Havale / EFT",
  cash_on_delivery: "Kapıda Ödeme",
};

export const CARRIER_OPTIONS = [
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "HepsiJet",
  "Trendyol Express",
  "Kolay Gelsin",
] as const;

/**
 * Verilen sipariş kimliğinden (Convex _id veya string) kullanıcı dostu
 * 8 haneli büyük harfli kısa sipariş kodunu türetir (Örn: "258G7TBY" veya "#258G7TBY").
 */
export function formatOrderCode(orderId?: string | null, prefix = false): string {
  if (!orderId) return "";
  const cleaned = String(orderId).trim();
  if (!cleaned) return "";
  const code = cleaned.slice(-8).toUpperCase();
  return prefix ? `#${code}` : code;
}

/**
 * Sipariş nesnesinden veya kimliğinden sipariş kodunu döner.
 * Eğer siparişte özel `orderNumber` alanı varsa onu kullanır, yoksa ID'den formatlar.
 */
export function getOrderCode(
  order?: { _id: string; orderNumber?: string | number } | string | null,
  prefix = false
): string {
  if (!order) return "";
  if (typeof order === "string") {
    return formatOrderCode(order, prefix);
  }
  if ("orderNumber" in order && order.orderNumber) {
    const num = String(order.orderNumber).trim();
    return prefix ? `#${num}` : num;
  }
  return formatOrderCode(order._id, prefix);
}

/**
 * Siparişin ödeme yöntemi başlığını döner. Varsa özel paymentMethodTitle'ı,
 * yoksa bilinen yöntemin Türkçe etiketini, o da yoksa varsayılan fallback değerini kullanır.
 */
export function getOrderPaymentMethodTitle(
  order?: { paymentMethod?: string | null; paymentMethodTitle?: string | null } | null,
  fallback = "Standart"
): string {
  if (!order) return fallback;
  if (order.paymentMethodTitle?.trim()) return order.paymentMethodTitle.trim();
  if (order.paymentMethod && paymentMethodLabels[order.paymentMethod]) {
    return paymentMethodLabels[order.paymentMethod];
  }
  return fallback;
}

/**
 * Telefon numarasını Türkiye/uluslararası standarda normalize edip WhatsApp doğrudan sohbet bağlantısı üretir.
 */
export function formatWhatsAppUrl(phone?: string | null, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const formatted = digits.startsWith("0")
    ? `9${digits}`
    : digits.startsWith("90")
      ? digits
      : `90${digits}`;
  const base = `https://wa.me/${formatted}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Telefon numarasını Türkiye standartlarında okunaklı ve biçimli gösterir.
 * Örn: "05551234567" -> "0 (555) 123 45 67"
 *      "+905551234567" -> "+90 (555) 123 45 67"
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `0 (${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `0 (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  if (digits.length === 12 && digits.startsWith("90")) {
    return `+90 (${digits.slice(2, 5)}) ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  return trimmed;
}


/**
 * Kargo firması ve takip numarasından resmi kargo takip URL'sini çözümler.
 */
export function resolveCarrierTrackingUrl(
  carrier?: string | null,
  trackingNumber?: string | null
): string | null {
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
