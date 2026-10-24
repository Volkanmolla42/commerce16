import type { Doc } from "@/convex/_generated/dataModel";

export type Order = Doc<"orders"> & {
  emailEvents?: Doc<"orderEmailEvents">[];
};

export type OrderEmailEvent = Doc<"orderEmailEvents">["event"];

export type DateRangeFilter = "all" | "today" | "yesterday" | "last7days" | "thisMonth" | "thisYear";

export const dateRangeOptions: { id: DateRangeFilter; label: string }[] = [
  { id: "all", label: "Tüm Zamanlar" },
  { id: "today", label: "Bugün" },
  { id: "yesterday", label: "Dün" },
  { id: "last7days", label: "Son 7 Gün" },
  { id: "thisMonth", label: "Bu Ay" },
  { id: "thisYear", label: "Bu Yıl" },
];

export const emailEventLabels: Record<OrderEmailEvent, string> = {
  order_placed: "Sipariş alındı bildirimi",
  payment_confirmed: "Ödeme onayı bildirimi",
  order_shipped: "Kargoya verildi bildirimi",
  order_delivered: "Teslimat bildirimi",
  order_cancelled: "İptal bilgilendirmesi",
  admin_order_alert: "Yeni sipariş bildirimi (yönetici)",
};

export const emailStatusLabels: Record<Doc<"orderEmailEvents">["status"], string> = {
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  not_configured: "Resend yapılandırılmamış",
  review: "İnceleme gerekli",
};
