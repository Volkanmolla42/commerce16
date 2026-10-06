"use client";

import { useMemo, useState } from "react";
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
import { AdminGate } from "../_components/admin-gate";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";
import { orderStatusLabels } from "@/lib/orders";

type Order = Doc<"orders">;
type OrderStatus = Order["status"];
const statuses: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
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
          <div className="flex items-center justify-between border-t border-border pt-4">
            <OrderStatusBadge status={order.status} />
            <p className="text-lg font-semibold tabular-nums text-foreground">Toplam {formatMoney(order.total)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminOrdersContent() {
  const { data: orders, error, loading, refresh } = useAdminResource<Order[]>("orders");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setSelectedOrder((current) => current?._id === order._id ? { ...current, status } : current);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sipariş durumu güncellenemedi.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Siparişler</h1>
      </div>
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:px-5">
          <div><Label htmlFor="order-search" className="sr-only">Sipariş ara</Label><Input id="order-search" name="order-search" type="search" placeholder="Sipariş, müşteri veya e-posta ara" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div><Label htmlFor="order-status-filter" className="sr-only">Duruma göre filtrele</Label><select id="order-status-filter" name="status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring"><option value="all">Tüm durumlar</option>{statuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select></div>
          <Button variant="outline" onClick={() => void refresh()}>Yenile</Button>
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
                  <select id={`status-${order._id}`} name={`status-${order._id}`} value={order.status} disabled={updatingId === order._id} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-medium text-foreground outline-none focus-visible:border-ring disabled:opacity-60">{statuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select>
                </div>
                <Button variant="outline" className="min-h-10" onClick={() => setSelectedOrder(order)}>Detay</Button>
              </article>
            ))}
          </div>
        )}
      </Card>

      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminGate>
      <AdminOrdersContent />
    </AdminGate>
  );
}
