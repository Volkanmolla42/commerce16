"use client";

import { useSyncExternalStore } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  orderStatusLabels,
  getOrderCode,
  getOrderPaymentMethodTitle,
  type OrderStatus,
  type OrderStatusUpdate,
} from "@/lib/orders";
import { formatMoney } from "@/lib/format-money";
import { TruckIcon } from "@heroicons/react/24/outline";
import { OrderPaymentStatusBadge } from "@/components/orders/order-badges";

type Order = Doc<"orders"> & {
  emailEvents?: Doc<"orderEmailEvents">[];
};

interface OrdersKanbanProps {
  orders: Order[];
  statuses: OrderStatus[];
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (
    order: Order,
    update: OrderStatusUpdate
  ) => Promise<void>;
  onOpenShippingDialog: (order: Order) => void;
  updatingId: string | null;
}

export function OrdersKanban({
  orders,
  statuses,
  onOpenOrder,
  onUpdateStatus,
  onOpenShippingDialog,
  updatingId,
}: OrdersKanbanProps) {
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetOrder = orders.find((o) => o._id === draggableId);
    if (!targetOrder) return;

    const newStatus = destination.droppableId as OrderStatus;
    if (targetOrder.status === newStatus) return;

    if (newStatus === "shipped") {
      onOpenShippingDialog(targetOrder);
    } else {
      void onUpdateStatus(targetOrder, { status: newStatus });
    }
  };

  // Her durum için siparişleri ve toplam tutarı hesapla
  const columnsData = statuses.map((status) => {
    const columnOrders = orders.filter((o) => o.status === status);
    const columnTotal = columnOrders.reduce((sum, o) => {
      const val = typeof o.total === "number" ? o.total : parseFloat(o.total) || 0;
      return sum + val;
    }, 0);
    return {
      status,
      label: orderStatusLabels[status],
      orders: columnOrders,
      total: columnTotal,
    };
  });

  const content = (
    <div className="flex gap-2.5 overflow-x-auto pb-4 pt-1 px-3 sm:px-4 w-full min-w-0">
      {columnsData.map((col) => {
        return (
          <div
            key={col.status}
            className="flex flex-col flex-1 min-w-[200px] xl:min-w-0 rounded-xl border border-border/80 bg-muted/20"
          >
            {/* Kolon Başlığı & Özeti */}
            <div className="p-2.5 border-b border-border/70 bg-muted/40 rounded-t-xl space-y-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-foreground tracking-tight">
                  {col.label}
                </span>
                <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground shrink-0">
                  {col.orders.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-sans font-medium">Toplam</span>
                <span className="font-semibold text-foreground/90 tabular-nums">{formatMoney(col.total)}</span>
              </div>
            </div>

            {/* Droppable Alanı */}
            {isMounted ? (
              <Droppable droppableId={col.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2.5 space-y-2.5 min-h-[440px] transition-colors rounded-b-xl ${
                      snapshot.isDraggingOver
                        ? "bg-muted/50 ring-1 ring-border"
                        : "bg-transparent"
                    }`}
                  >
                    {col.orders.length === 0 ? (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
                        <span className="text-xs text-muted-foreground">
                          Bu aşamada sipariş yok
                        </span>
                      </div>
                    ) : (
                      col.orders.map((order, index) => {
                        const isUpdating = updatingId === order._id;

                        return (
                          <Draggable
                            key={order._id}
                            draggableId={order._id}
                            index={index}
                            isDragDisabled={isUpdating}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                role="button"
                                onClick={() => onOpenOrder(order)}
                                className={`group rounded-lg border border-border bg-card p-3 space-y-2 select-none transition-all cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-xs ${
                                  dragSnapshot.isDragging
                                    ? "shadow-lg ring-1 ring-border bg-card opacity-95 scale-[1.02]"
                                    : ""
                                } ${isUpdating ? "opacity-50 pointer-events-none" : ""}`}
                              >
                                {/* 1. Sipariş No & Tutar & Ödeme Rozeti */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-xs font-bold text-foreground tracking-tight">
                                    {getOrderCode(order, true)}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                                      {formatMoney(order.total)}
                                    </span>
                                    <OrderPaymentStatusBadge
                                      status={order.paymentStatus}
                                      className="text-[9px] px-1.5 py-0.5"
                                    />
                                  </div>
                                </div>

                                {/* 2. Sipariş İçeriği: Kartın Odak Noktası */}
                                <div className="space-y-1 py-0.5">
                                  {order.items.slice(0, 2).map((item) => (
                                    <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex items-start gap-1.5 text-xs leading-snug">
                                      <span className="font-mono font-semibold text-foreground/80 shrink-0">
                                        {item.quantity}×
                                      </span>
                                      <span className="font-medium text-foreground truncate" title={item.title}>
                                        {item.title}
                                      </span>
                                    </div>
                                  ))}
                                  {order.items.length > 2 && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      +{order.items.length - 2} ürün daha
                                    </p>
                                  )}
                                </div>

                                {/* 3. Müşteri & İkincil Detaylar */}
                                <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground min-w-0">
                                  <span className="truncate font-medium text-muted-foreground" title={order.customerName}>
                                    {order.customerName}
                                  </span>
                                  {order.carrier ? (
                                    <span
                                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground shrink-0"
                                      title={`${order.carrier} ${order.trackingNumber ?? ""}`}
                                    >
                                      <TruckIcon className="size-3 shrink-0" />
                                      <span className="truncate max-w-[70px]">{order.carrier}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/80 shrink-0 truncate max-w-[85px]">
                                      {getOrderPaymentMethodTitle(order)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ) : (
              // SSR / İlk Yükleme Statik Görünüm
              <div className="flex-1 p-2.5 space-y-2.5 min-h-[440px]">
                {col.orders.map((order) => (
                  <div
                    key={order._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenOrder(order)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenOrder(order);
                      }
                    }}
                    className="rounded-lg border border-border bg-card p-3 space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-xs font-bold text-foreground tracking-tight">
                        {getOrderCode(order, true)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                          {formatMoney(order.total)}
                        </span>
                        <OrderPaymentStatusBadge
                          status={order.paymentStatus}
                          className="text-[9px] px-1.5 py-0.5"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 py-0.5">
                      {order.items.slice(0, 2).map((item) => (
                        <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex items-start gap-1.5 text-xs leading-snug">
                          <span className="font-mono font-semibold text-foreground/80 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-medium text-foreground truncate" title={item.title}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          +{order.items.length - 2} ürün daha
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground min-w-0">
                      <span className="truncate font-medium text-muted-foreground">
                        {order.customerName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 shrink-0">
                        {getOrderPaymentMethodTitle(order)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!isMounted) {
    return content;
  }

  return <DragDropContext onDragEnd={handleDragEnd}>{content}</DragDropContext>;
}
