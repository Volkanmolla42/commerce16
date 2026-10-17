export const ORDER_STATUS_CONFIG = {
  received: {
    label: "Sipariş Alındı",
    step: 0,
  },
  shipped: {
    label: "Kargoya verildi",
    step: 1,
  },
  delivered: {
    label: "Teslim edildi",
    step: 2,
  },
  cancelled: {
    label: "İptal edildi",
    step: -1,
  },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG;
export const ORDER_STATUS_KEYS = Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[];

export const ORDER_PAYMENT_STATUS_CONFIG = {
  pending: {
    label: "Ödeme Bekliyor",
  },
  paid: {
    label: "Ödendi",
  },
  failed: {
    label: "Başarısız",
  },
  refunded: {
    label: "İade Edildi",
  },
} as const;

export type OrderPaymentStatus = keyof typeof ORDER_PAYMENT_STATUS_CONFIG;
export const ORDER_PAYMENT_STATUS_KEYS = Object.keys(ORDER_PAYMENT_STATUS_CONFIG) as OrderPaymentStatus[];

function toLabelMap<T extends Record<string, { label: string }>>(config: T): Record<keyof T, string> {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, value.label])
  ) as Record<keyof T, string>;
}

export const orderStatusLabels = toLabelMap(ORDER_STATUS_CONFIG);
export const orderPaymentStatusLabels = toLabelMap(ORDER_PAYMENT_STATUS_CONFIG);

export const ORDER_TRACKING_STEPS = ORDER_STATUS_KEYS
  .filter((key) => ORDER_STATUS_CONFIG[key].step >= 0)
  .map((key) => ({ key, label: ORDER_STATUS_CONFIG[key].label }));

export function getOrderStepIndex(status?: string | null): number {
  if (!status || !Object.hasOwn(ORDER_STATUS_CONFIG, status)) return 0;
  return ORDER_STATUS_CONFIG[status as OrderStatus].step;
}

/** İptal edilmemiş ve ödemesi alınmış siparişler ciro/satın alma sayılır. */
export function isRevenueOrder(order: { status: OrderStatus; paymentStatus: OrderPaymentStatus }): boolean {
  return order.status !== "cancelled" && order.paymentStatus === "paid";
}

/** Sipariş durum/kargo güncellemesinin ortak şekli. */
export type OrderStatusUpdate = {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

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

export interface OrderPriceBreakdown {
  itemsSubtotal: number;
  couponDiscount: number;
  paymentFee: number;
  shippingFee: number;
  isFreeShipping: boolean;
  total: number;
}

/**
 * Sipariş nesnesinden ara toplam, kupon indirimi, kargo ücreti, kapıda ödeme bedeli
 * ve genel toplam tutarlarını hesaplar.
 */
export function getOrderPriceBreakdown(order?: {
  total: string | number;
  items: Array<{ price: string | number; quantity: number }>;
  shippingFee?: number | null;
  paymentFee?: number | null;
  couponDiscountKurus?: number | null;
} | null): OrderPriceBreakdown {
  if (!order) {
    return {
      itemsSubtotal: 0,
      couponDiscount: 0,
      paymentFee: 0,
      shippingFee: 0,
      isFreeShipping: true,
      total: 0,
    };
  }

  const total = typeof order.total === "number" ? order.total : parseFloat(order.total) || 0;
  const itemsSubtotal = (order.items || []).reduce(
    (sum, item) =>
      sum +
      (typeof item.price === "number" ? item.price : parseFloat(item.price) || 0) *
        (item.quantity || 1),
    0
  );
  const couponDiscount = (order.couponDiscountKurus ?? 0) / 100;
  const paymentFee = order.paymentFee ?? 0;
  const shippingFee = order.shippingFee ?? 0;
  const isFreeShipping = shippingFee <= 0;

  return {
    itemsSubtotal,
    couponDiscount,
    paymentFee,
    shippingFee,
    isFreeShipping,
    total,
  };
}
