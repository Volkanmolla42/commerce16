"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrdersKanban } from "./_components/orders-kanban";
import { AdminActionNotice, AdminEmpty, AdminListCard, AdminLoading } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import {
  ORDER_STATUS_KEYS,
  type OrderStatus,
  type OrderStatusUpdate,
  formatOrderCode,
} from "@/lib/orders";
import { adminPath } from "@/lib/admin/routes";
import { OrderDetails } from "./_components/order-details";
import { OrdersFilters } from "./_components/orders-filters";
import { OrdersList } from "./_components/orders-list";
import { ShippingDialog } from "./_components/shipping-dialog";
import {
  emailEventLabels,
  type DateRangeFilter,
  type Order,
  type OrderEmailEvent,
} from "./_components/order-admin-shared";

const statuses = ORDER_STATUS_KEYS;

function matchesDateRange(creationTime: number, range: DateRangeFilter): boolean {
  if (range === "all") return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (range === "today") {
    return creationTime >= startOfToday;
  }

  if (range === "yesterday") {
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    return creationTime >= startOfYesterday && creationTime < startOfToday;
  }

  if (range === "last7days") {
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return creationTime >= sevenDaysAgo;
  }

  if (range === "thisMonth") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return creationTime >= startOfMonth;
  }

  if (range === "thisYear") {
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    return creationTime >= startOfYear;
  }

  return true;
}

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: orders, error, loading, refresh } = useAdminResource<Order[]>("orders");

  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [selectedOrderOverride, setSelectedOrderOverride] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shippingDialogOrder, setShippingDialogOrder] = useState<Order | null>(null);

  const [retryingEmailKey, setRetryingEmailKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedOrderId = searchParams.get("order");
  const selectedOrder = selectedOrderId
    ? selectedOrderOverride?._id === selectedOrderId
      ? selectedOrderOverride
      : orders?.find((order) => order._id === selectedOrderId) ?? null
    : null;

  const openOrder = (order: Order) => {
    setSelectedOrderOverride(order);
    const params = new URLSearchParams(searchParams.toString());
    params.set("order", order._id);
    router.push(`${adminPath("orders")}?${params.toString()}`, { scroll: false });
  };

  const closeOrder = () => {
    setSelectedOrderOverride(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("order");
    const queryString = params.toString();
    router.replace(`${adminPath("orders")}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };

  const term = query.trim().toLocaleLowerCase("tr-TR");
  const filteredOrders = (orders || []).filter((order) => {
    const matchesTerm =
      !term ||
      `${order._id} ${order.customerName} ${order.customerEmail} ${order.customerPhone || ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(term);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesDate = matchesDateRange(order._creationTime, dateFilter);
    const matchesPayment =
      paymentMethodFilter === "all" || order.paymentMethod === paymentMethodFilter;
    const matchesPaymentStatus =
      paymentStatusFilter === "all" || order.paymentStatus === paymentStatusFilter;
    return matchesTerm && matchesStatus && matchesDate && matchesPayment && matchesPaymentStatus;
  });

  const baseForCounts = (orders || []).filter((order) => {
    const matchesTerm =
      !term ||
      `${order._id} ${order.customerName} ${order.customerEmail} ${order.customerPhone || ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(term);
    const matchesDate = matchesDateRange(order._creationTime, dateFilter);
    const matchesPayment = paymentMethodFilter === "all" || order.paymentMethod === paymentMethodFilter;
    const matchesPaymentStatus =
      paymentStatusFilter === "all" || order.paymentStatus === paymentStatusFilter;
    return matchesTerm && matchesDate && matchesPayment && matchesPaymentStatus;
  });

  const counts = baseForCounts.reduce<Record<string, number>>(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const updateStatus = async (
    order: Order,
    update: OrderStatusUpdate
  ) => {
    setUpdatingId(order._id);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("order.status", { id: order._id, ...update });
      setSelectedOrderOverride((prev) =>
        prev && prev._id === order._id ? { ...prev, ...update } : prev
      );
      setMessage(`Sipariş ${formatOrderCode(order, true)} güncellendi.`);
      await refresh();
      // Sunucuda türetilen alanlar (ör. teslimatta otomatik ödeme) taze veride gelir;
      // override bırakılınca modal listedeki güncel siparişi gösterir.
      setSelectedOrderOverride(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sipariş durumu güncellenemedi.");
    }
    setUpdatingId(null);
  };

  const retryEmail = async (order: Order, event: OrderEmailEvent) => {
    const key = `${order._id}:${event}`;
    setRetryingEmailKey(key);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("email.retry", { orderId: order._id, event });
      setMessage(`${emailEventLabels[event]} kuyruğa alındı.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "E-posta gönderilemedi.");
    }
    setRetryingEmailKey(null);
  };



  return (
    <>
      <AdminActionNotice message={message} error={actionError || error} />

      <AdminListCard
        loading={loading}
        loadingLabel="Siparişler"
        empty={
          filteredOrders.length === 0 ? (
            <AdminEmpty
              title={query || statusFilter !== "all" ? "Eşleşen sipariş bulunamadı" : "Henüz sipariş yok"}
              description="Arama veya filtre kriterlerini değiştirip deneyin."
            />
          ) : null
        }
        toolbar={
          <OrdersFilters
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            counts={counts}
            totalCount={baseForCounts.length}
            query={query}
            onQueryChange={setQuery}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            paymentMethodFilter={paymentMethodFilter}
            onPaymentMethodFilterChange={setPaymentMethodFilter}
            paymentStatusFilter={paymentStatusFilter}
            onPaymentStatusFilterChange={setPaymentStatusFilter}
            onReset={() => {
              setStatusFilter("all");
              setDateFilter("all");
              setPaymentMethodFilter("all");
              setPaymentStatusFilter("all");
              setQuery("");
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={filteredOrders.length}
          />
        }
      >
        {viewMode === "kanban" ? (
          <div className="py-3 w-full min-w-0 overflow-hidden">
            <OrdersKanban
              orders={filteredOrders}
              statuses={statusFilter === "all" ? statuses : [statusFilter]}
              onOpenOrder={openOrder}
              onUpdateStatus={updateStatus}
              onOpenShippingDialog={(o) => setShippingDialogOrder(o)}
              updatingId={updatingId}
            />
          </div>
        ) : (
          <OrdersList
            orders={filteredOrders}
            statuses={statuses}
            updatingId={updatingId}
            onOpenOrder={openOrder}
            onUpdateStatus={updateStatus}
            onOpenShippingDialog={(o) => setShippingDialogOrder(o)}
          />
        )}
      </AdminListCard>

      {/* Sipariş Detay Modalı */}
      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={closeOrder}
          onRetryEmail={(event) => void retryEmail(selectedOrder, event)}
          retryingEmailKey={retryingEmailKey}
          onUpdateStatus={updateStatus}
          onOpenShippingDialog={(o) => setShippingDialogOrder(o)}
          isUpdatingStatus={updatingId === selectedOrder._id}
        />
      )}

      {/* Kargo Bilgisi Modalı (window.prompt yerine) */}
      {shippingDialogOrder && (
        <ShippingDialog
          order={shippingDialogOrder}
          onClose={() => setShippingDialogOrder(null)}
          onSubmit={async (carrier, trackingNumber) => {
            await updateStatus(shippingDialogOrder, {
              status: "shipped",
              carrier: carrier || undefined,
              trackingNumber: trackingNumber || undefined,
            });
          }}
        />
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<AdminLoading label="Siparişler" variant="table" />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
