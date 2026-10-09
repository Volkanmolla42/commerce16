"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Button,
  Input,
  Label,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, OrderStatusBadge } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";
import { orderStatusLabels } from "@/lib/orders";
import { adminPath } from "@/lib/admin/routes";

type Order = Doc<"orders"> & {
  emailEvents?: Doc<"orderEmailEvents">[];
};
type OrderStatus = Order["status"];
type OrderEmailEvent = Doc<"orderEmailEvents">["event"];
const statuses: OrderStatus[] = ["pending", "paid", "cancelled"];

function availableStatusOptions(order: Order) {
  const options: OrderStatus[] = [order.status];
  if (order.status === "pending") {
    options.push("paid", "cancelled");
  } else if (order.status === "paid") {
    options.push("cancelled");
  }
  return options;
}

const emailEventLabels: Record<OrderEmailEvent, string> = {
  payment_confirmation: "Ödeme ve sipariş özeti",
};
const emailStatusLabels: Record<Doc<"orderEmailEvents">["status"], string> = {
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  not_configured: "Resend ayarlı değil",
  review: "Gönderim sonucu kontrol edilmeli",
};
function OrderDetails({
  order,
  onClose,
  onRetryEmail,
  retryingEmailKey,
}: {
  order: Order;
  onClose: () => void;
  onRetryEmail: (event: OrderEmailEvent) => void;
  retryingEmailKey: string | null;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Sipariş #{order._id.slice(-8).toUpperCase()}</DialogTitle></DialogHeader>
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Müşteri</h3>
            <p className="mt-2 font-semibold text-foreground">{order.customerName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{order.customerEmail}</p>
            {order.customerPhone && <p className="mt-1 text-sm text-muted-foreground">{order.customerPhone}</p>}
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Ürünler</h3>
            <div className="mt-2 divide-y divide-border rounded-md border border-border">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <div><p className="font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.quantity} adet</p></div>
                  <p className="shrink-0 font-semibold tabular-nums text-foreground">{formatMoney(item.price)}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Teslimat</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{order.shippingAddress || "Adres girilmemiş."}</p>
          </section>
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">E-posta bildirimleri</h3>
            {(order.emailEvents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Bu sipariş için henüz bildirim kaydı yok.</p>
            ) : (order.emailEvents ?? []).map((emailEvent) => (
              <div key={emailEvent._id} className="space-y-1 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{emailEventLabels[emailEvent.event]}</span>
                  <span className="text-xs text-muted-foreground">{emailStatusLabels[emailEvent.status]}</span>
                </div>
                {emailEvent.error && <p className="text-xs text-destructive">{emailEvent.error}</p>}
                {emailEvent.status === "review" && <p className="text-xs text-amber-700 dark:text-amber-300">Mükerrer gönderimi önlemek için tekrar kapalı. Resend panelinde kontrol edin.</p>}
                {(emailEvent.status === "failed" || emailEvent.status === "not_configured") && (
                  <Button type="button" size="sm" variant="outline" disabled={retryingEmailKey === `${order._id}:${emailEvent.event}`} onClick={() => onRetryEmail(emailEvent.event)}>
                    {retryingEmailKey === `${order._id}:${emailEvent.event}` ? "Kuyruğa alınıyor…" : "E-postayı yeniden dene"}
                  </Button>
                )}
              </div>
            ))}
          </section>
          {order.legalAcceptance && (
            <section className="space-y-1 border-t border-border pt-4">
              <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Sipariş onay kayıtları</h3>
              <p className="text-xs text-muted-foreground">{order.legalAcceptance.distanceSalesAgreement.title} ve {order.legalAcceptance.preInformationForm.title}</p>
              <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.legalAcceptance.acceptedAt))} · belge sürümleri {order.legalAcceptance.distanceSalesAgreement.version} / {order.legalAcceptance.preInformationForm.version}</p>
            </section>
          )}
          <div className="space-y-2 border-t border-border pt-4">
            {order.couponCode && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Kupon · {order.couponCode}</span>
                <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">−{formatMoney((order.couponDiscountKurus ?? 0) / 100)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <OrderStatusBadge status={order.status} />
              <p className="text-lg font-semibold tabular-nums text-foreground">Toplam {formatMoney(order.total)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: orders, error, loading, refresh } = useAdminResource<Order[]>("orders");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [selectedOrderOverride, setSelectedOrderOverride] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return (orders || []).filter((order) => {
      const matchesTerm = !term || `${order._id} ${order.customerName} ${order.customerEmail}`.toLocaleLowerCase("tr-TR").includes(term);
      return matchesTerm && (statusFilter === "all" || order.status === statusFilter);
    });
  }, [orders, query, statusFilter]);

  const updateStatus = async (order: Order, status: OrderStatus) => {
    setUpdatingId(order._id);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("order.status", { id: order._id, status });
      setMessage(`Sipariş #${order._id.slice(-8).toUpperCase()} güncellendi.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sipariş durumu güncellenemedi.");
    } finally {
      setUpdatingId(null);
    }
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
      setActionError(cause instanceof Error ? cause.message : "E-posta yeniden kuyruğa alınamadı.");
    } finally {
      setRetryingEmailKey(null);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Siparişler</h1>
      </div>
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-5">
          <div><Label htmlFor="order-search" className="sr-only">Sipariş ara</Label><Input id="order-search" name="order-search" type="search" placeholder="Sipariş, müşteri veya e-posta ara" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div><Label htmlFor="order-status-filter" className="sr-only">Duruma göre filtrele</Label><select id="order-status-filter" name="status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring"><option value="all">Tüm durumlar</option>{statuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select></div>
        </div>

        {loading ? <div className="p-5"><AdminLoading label="Siparişler" /></div> : filteredOrders.length === 0 ? (
          <div className="p-5"><AdminEmpty title={query || statusFilter !== "all" ? "Eşleşen sipariş yok" : "Henüz sipariş yok"} description={query || statusFilter !== "all" ? "Arama veya durum filtresini değiştirip yeniden dene." : "Siparişler geldikçe burada görünecek."} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filteredOrders.map((order) => (
              <article key={order._id} className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_110px_150px_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-muted-foreground">#{order._id.slice(-8).toUpperCase()}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{order.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{order.customerEmail}</p>
                </div>
                <p className="text-xs text-muted-foreground"><span className="mr-2 font-medium lg:hidden">Tarih</span>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order._creationTime))}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(order.total)}</p>
                <div className="space-y-1">
                  <Label htmlFor={`status-${order._id}`} className="sr-only">Sipariş #{order._id.slice(-8)} durumu</Label>
                  <select id={`status-${order._id}`} name={`status-${order._id}`} value={order.status} disabled={updatingId === order._id} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-medium text-foreground outline-none focus-visible:border-ring disabled:opacity-60">{availableStatusOptions(order).map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select>
                </div>
                <Button variant="outline" className="min-h-10" onClick={() => openOrder(order)}>Detay</Button>
              </article>
            ))}
          </div>
        )}
      </Card>

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={closeOrder}
          onRetryEmail={(event) => void retryEmail(selectedOrder, event)}
          retryingEmailKey={retryingEmailKey}
        />
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<AdminLoading label="Siparişler" />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
