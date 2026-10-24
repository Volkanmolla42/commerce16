"use client";

import {
  ClockIcon,
  TruckIcon,
  CheckBadgeIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  orderStatusLabels,
  orderPaymentStatusLabels,
  type OrderStatus,
  type OrderPaymentStatus,
} from "@/lib/orders";
import { Badge } from "@/components/ui/badge";

const ORDER_STATUS_PRESENTATION: Record<
  OrderStatus,
  { icon: typeof ClockIcon; className: string }
> = {
  received: {
    icon: ClockIcon,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  shipped: {
    icon: TruckIcon,
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  delivered: {
    icon: CheckBadgeIcon,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  cancelled: {
    icon: XCircleIcon,
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
};

export const ORDER_STATUS_ICONS = Object.fromEntries(
  Object.entries(ORDER_STATUS_PRESENTATION).map(([status, config]) => [status, config.icon])
) as Record<OrderStatus, typeof ClockIcon>;

export const ORDER_PAYMENT_STATUS_STYLES: Record<OrderPaymentStatus, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  refunded: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

export function OrderStatusBadge({
  status,
  className = "",
}: {
  status: OrderStatus;
  className?: string;
}) {
  const { icon: Icon, className: style } = ORDER_STATUS_PRESENTATION[status];

  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${style} ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{orderStatusLabels[status]}</span>
    </Badge>
  );
}

export function OrderPaymentStatusBadge({
  status,
  className = "",
}: {
  status: OrderPaymentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`font-semibold border ${ORDER_PAYMENT_STATUS_STYLES[status]} ${className}`}
    >
      {orderPaymentStatusLabels[status]}
    </Badge>
  );
}
