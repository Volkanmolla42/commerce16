import { v, type Infer } from "convex/values";
import type { OrderStatus } from "../../lib/orders";

/**
 * Sipariş e-postası olayları. Her olay tek bir anlama gelir ve
 * `orderEmailEvents` tablosunda kendi `(orderId, event)` kaydıyla izlenir.
 */
export const orderEmailEventValidator = v.union(
  v.literal("order_placed"),
  v.literal("payment_confirmed"),
  v.literal("order_shipped"),
  v.literal("order_delivered"),
  v.literal("order_cancelled"),
  v.literal("admin_order_alert")
);

export type OrderEmailEvent = Infer<typeof orderEmailEventValidator>;

/** Olayın gönderilebileceği sipariş durumları. */
export function canSendOrderEvent(event: OrderEmailEvent, status: OrderStatus): boolean {
  switch (event) {
    case "order_placed":
    case "payment_confirmed":
    case "admin_order_alert":
      return status !== "cancelled";
    case "order_shipped":
      return status === "shipped" || status === "delivered";
    case "order_delivered":
      return status === "delivered";
    case "order_cancelled":
      return status === "cancelled";
  }
}

/** Yönetici bildirimi yeniden gönderilemez. */
export function isRetryableOrderEvent(event: OrderEmailEvent): boolean {
  return event !== "admin_order_alert";
}
