"use client";

import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrderPaymentStatusBadge } from "@/components/orders/order-badges";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  formatOrderCode,
  getOrderPaymentMethodTitle,
  orderStatusLabels,
  type OrderStatus,
  type OrderStatusUpdate,
} from "@/lib/orders";
import type { Order } from "./order-admin-shared";

const LIST_COLUMNS = "lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_110px_150px_88px]";

export function OrdersList({
  orders,
  statuses,
  updatingId,
  onOpenOrder,
  onUpdateStatus,
  onOpenShippingDialog,
}: {
  orders: Order[];
  statuses: readonly OrderStatus[];
  updatingId: string | null;
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (order: Order, update: OrderStatusUpdate) => Promise<void>;
  onOpenShippingDialog: (order: Order) => void;
}) {
  return (
    <div className="divide-y divide-border">
      <div
        className={`hidden gap-4 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-5 lg:grid lg:items-center ${LIST_COLUMNS}`}
      >
        <span>Sipariş</span>
        <span>Tarih</span>
        <span>Tutar</span>
        <span>Durum</span>
        <span className="text-right">İşlem</span>
      </div>

      {orders.map((order) => (
        <article
          key={order._id}
          className={`grid gap-4 px-4 py-4 sm:px-5 lg:items-center ${LIST_COLUMNS} hover:bg-muted/30 transition-colors`}
        >
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-muted-foreground">
              {formatOrderCode(order, true)}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {order.customerName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{order.customerEmail}</p>
            <p className="truncate text-[11px] font-medium text-primary mt-0.5">
              {getOrderPaymentMethodTitle(order)}
            </p>
            {order.billingType === "corporate" && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                <BuildingOffice2Icon className="size-3" />
                Kurumsal Fatura
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="mr-2 font-medium lg:hidden">Tarih</span>
            {formatDateTime(order._creationTime, { dateStyle: "medium", timeStyle: "short" })}
          </p>

          <div>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(order.total)}
            </p>
            <div className="mt-0.5">
              <OrderPaymentStatusBadge
                status={order.paymentStatus}
                className="text-[10px] px-1.5 py-0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`status-${order._id}`} className="sr-only">
              Durum
            </Label>
            <select
              id={`status-${order._id}`}
              name={`status-${order._id}`}
              value={order.status}
              disabled={updatingId === order._id}
              onChange={(event) => {
                const newStatus = event.target.value as OrderStatus;
                if (newStatus === "shipped") {
                  onOpenShippingDialog(order);
                } else {
                  void onUpdateStatus(order, { status: newStatus });
                }
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring disabled:opacity-60 cursor-pointer"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => onOpenOrder(order)}
            >
              Detay
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
