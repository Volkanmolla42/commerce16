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
  invoice?: Doc<"invoiceRecords"> | null;
  emailEvents?: Doc<"orderEmailEvents">[];
  shippingShipment?: Doc<"shippingShipments"> | null;
};
type OrderStatus = Order["status"];
type OrderEmailEvent = Doc<"orderEmailEvents">["event"];
const statuses: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

function availableStatusOptions(order: Order) {
  const options: OrderStatus[] = [order.status];
  if (order.status === "pending") {
    options.push("paid", "cancelled");
  } else if (order.status === "paid") {
    options.push("shipped", "cancelled");
  } else if (order.status === "shipped") {
    options.push("delivered");
  }
  return options;
}

const invoiceStatusLabels: Record<Doc<"invoiceRecords">["status"], string> = {
  queued: "Sırada",
  processing: "Düzenleniyor",
  issued: "Düzenlendi",
  failed: "Hata",
  not_configured: "Entegratör ayarlı değil",
  review: "Panelde kontrol gerekli",
};
const emailEventLabels: Record<OrderEmailEvent, string> = {
  payment_confirmation: "Ödeme ve sipariş özeti",
  shipping_update: "Kargo takip bildirimi",
};
const emailStatusLabels: Record<Doc<"orderEmailEvents">["status"], string> = {
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  not_configured: "Resend ayarlı değil",
  review: "Gönderim sonucu kontrol edilmeli",
};
const shippingStatusLabels: Record<Doc<"shippingShipments">["status"], string> = {
  creating: "Gönderi oluşturuluyor",
  quoted: "Teklif seçimi bekleniyor",
  purchasing: "Etiket satın alınıyor",
  purchased: "Etiket satın alındı",
  failed: "Gönderi oluşturulamadı",
  review: "Sonuç incelemesi gerekli",
};
const shippingErrorLabels: Record<string, string> = {
  not_configured: "Geliver ayarları eksik.",
  invalid_store_url: "Mağaza URL ayarı geçersiz.",
  recipient_phone_missing: "Müşteri telefon numarası kargo formatında değil.",
  recipient_address_incomplete: "Teslimat adresi kargo için eksik.",
  order_total_invalid: "Sipariş tutarı geçersiz.",
  provider_rejected: "Geliver isteği reddetti.",
  provider_unavailable: "Geliver şu anda yanıt vermiyor.",
  provider_result_unknown: "Geliver sonucu doğrulanamadı.",
  invalid_response: "Geliver beklenmeyen yanıt verdi.",
  shipment_reference_missing: "Geliver gönderi referansı vermedi.",
  transaction_reference_missing: "Satın alma yanıtında gönderi referansı bulunamadı.",
};

function OrderDetails({
  order,
  onClose,
  onRetryInvoice,
  retryingInvoice,
  onRetryEmail,
  retryingEmailKey,
  onActionSuccess,
  onShippingUpdate,
}: {
  order: Order;
  onClose: () => void;
  onRetryInvoice: () => void;
  retryingInvoice: boolean;
  onRetryEmail: (event: OrderEmailEvent) => void;
  retryingEmailKey: string | null;
  onActionSuccess: (message: string) => void;
  onShippingUpdate: (record: Doc<"shippingShipments"> | null) => void;
}) {
  const [shippingBusy, setShippingBusy] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);

  const runShippingAction = async (action: string, input: Record<string, string>) => {
    if (shippingBusy) return;
    setShippingBusy(true);
    setShippingError(null);
    setShippingMessage(null);
    try {
      const result = await runAdminAction<{ record: Doc<"shippingShipments"> | null; message: string; isError: boolean }>(action, input);
      onShippingUpdate(result.record);
      setShippingMessage(result.isError ? null : result.message);
      setShippingError(result.isError ? result.message : null);
    } catch (cause) {
      setShippingError(cause instanceof Error ? cause.message : "Kargo işlemi tamamlanamadı.");
    } finally {
      setShippingBusy(false);
    }
  };

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
          {(order.status === "paid" || order.status === "shipped" || order.status === "delivered") && (
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Geliver kargo</h3>
                {order.shippingShipment && <span className="text-xs font-semibold text-muted-foreground">{shippingStatusLabels[order.shippingShipment.status]}</span>}
              </div>
              {order.shippingShipment?.carrierName && <p className="text-sm font-medium text-foreground">{order.shippingShipment.carrierName}</p>}
              {order.shippingShipment?.trackingNumber && <p className="text-sm text-foreground">Takip no: <span className="font-mono">{order.shippingShipment.trackingNumber}</span></p>}
              {order.shippingShipment?.trackingUrl && (
                <a href={order.shippingShipment.trackingUrl} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline underline-offset-4">Kargo takibini aç</a>
              )}
              {order.shippingShipment?.labelUrl && (
                <a href={order.shippingShipment.labelUrl} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline underline-offset-4">Kargo etiketini yazdır</a>
              )}
              {order.shippingShipment?.status === "purchased" && !order.shippingShipment.trackingNumber && (
                <p className="text-xs text-muted-foreground">Kargo firması takip kodunu oluşturduğunda burada görünecek.</p>
              )}
              {order.shippingShipment?.status === "purchased" && (
                <Button type="button" size="sm" variant="outline" disabled={shippingBusy} onClick={() => void runShippingAction("shipping.refresh-offers", { orderId: order._id })}>
                  {shippingBusy ? "Kontrol ediliyor…" : "Takip durumunu kontrol et"}
                </Button>
              )}
              {order.shippingShipment?.status === "review" && (
                <AdminNotice kind="error">Satın alma sonucu belirsiz. Mükerrer ücret oluşmaması için işlemi otomatik tekrarlamayın.</AdminNotice>
              )}
              {order.shippingShipment?.errorCode && order.shippingShipment.status !== "review" && (
                <p className="text-xs text-destructive">{shippingErrorLabels[order.shippingShipment.errorCode] ?? "Kargo sağlayıcısı hatası."}</p>
              )}
              {order.shippingShipment?.status === "quoted" && order.shippingShipment.offers.length > 0 && (
                <div className="divide-y divide-border rounded-md border border-border">
                  {[...order.shippingShipment.offers].sort((a, b) => a.priceKurus - b.priceKurus).map((offer) => {
                    const cheapest = offer.priceKurus === Math.min(...order.shippingShipment!.offers.map((entry) => entry.priceKurus));
                    const fastest = offer.estimatedDays !== undefined && offer.estimatedDays === Math.min(...order.shippingShipment!.offers.flatMap((entry) => entry.estimatedDays === undefined ? [] : [entry.estimatedDays]));
                    return (
                      <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{offer.carrierName} · {offer.serviceName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {offer.estimatedDays ? `${offer.estimatedDays} iş günü` : "Teslimat süresi belirtilmedi"}
                            {cheapest ? " · En uygun fiyat" : ""}{fastest ? " · En hızlı" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(offer.priceKurus / 100)}</span>
                          <Button type="button" size="sm" variant="outline" disabled={shippingBusy} onClick={() => void runShippingAction("shipping.purchase-label", { orderId: order._id, offerId: offer.id })}>
                            {shippingBusy ? "Bekleyin…" : "Etiketi satın al"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {order.shippingShipment?.status === "quoted" && order.shippingShipment.offers.length === 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Kargo teklifleri hazırlanıyor.</p>
                  <Button type="button" size="sm" variant="outline" disabled={shippingBusy} onClick={() => void runShippingAction("shipping.refresh-offers", { orderId: order._id })}>Teklifleri tekrar al</Button>
                </div>
              )}
              {(!order.shippingShipment || order.shippingShipment.status === "failed") && order.status === "paid" && (
                <Button type="button" variant="outline" disabled={shippingBusy} onClick={() => void runShippingAction("shipping.create", { orderId: order._id })}>
                  {shippingBusy ? "Gönderi hazırlanıyor…" : "Kargo teklifi al"}
                </Button>
              )}
              {shippingError && <AdminNotice kind="error">{shippingError}</AdminNotice>}
              {shippingMessage && <AdminNotice kind="success">{shippingMessage}</AdminNotice>}
            </section>
          )}
          <section className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">e-Fatura / e-Arşiv</h3>
              {order.invoice && <span className="text-xs font-medium text-muted-foreground">{invoiceStatusLabels[order.invoice.status]}</span>}
            </div>
            {order.invoice?.documentType && <p className="text-sm text-foreground">{order.invoice.documentType === "e_fatura" ? "e-Fatura" : "e-Arşiv Fatura"} · {order.invoice.providerReference}</p>}
            {order.invoice?.documentUrl && <a href={order.invoice.documentUrl} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline underline-offset-4">Fatura belgesini aç</a>}
            {order.invoice?.error && <p className="text-xs text-destructive">{order.invoice.error}</p>}
            {order.invoiceRecipient?.type === "business" && (
              <p className="text-xs text-muted-foreground">{order.invoiceRecipient.businessTitle} · VKN {order.invoiceRecipient.taxNumber} · {order.invoiceRecipient.taxOffice}</p>
            )}
            {order.status === "paid" && order.invoice?.status !== "issued" && order.invoice?.status !== "processing" && order.invoice?.status !== "review" && (
              <Button type="button" size="sm" variant="outline" disabled={retryingInvoice} onClick={onRetryInvoice}>
                {retryingInvoice ? "Kuyruğa alınıyor…" : "Faturayı yeniden dene"}
              </Button>
            )}
            {order.invoice?.status === "review" && <p className="text-xs text-amber-700 dark:text-amber-300">Mükerrer belge riskini önlemek için otomatik tekrar kapalı. Paraşüt panelinde kontrol edin.</p>}
            {!order.invoice && order.status !== "paid" && <p className="text-xs text-muted-foreground">Ödeme alındıktan sonra fatura kuyruğu başlatılır.</p>}
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
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(null);
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

  const retryInvoice = async (order: Order) => {
    setRetryingInvoiceId(order._id);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("invoice.retry", { orderId: order._id });
      setMessage(`Sipariş #${order._id.slice(-8).toUpperCase()} faturası kuyruğa alındı.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Fatura yeniden kuyruğa alınamadı.");
    } finally {
      setRetryingInvoiceId(null);
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
          onRetryInvoice={() => void retryInvoice(selectedOrder)}
          retryingInvoice={retryingInvoiceId === selectedOrder._id}
          onRetryEmail={(event) => void retryEmail(selectedOrder, event)}
          retryingEmailKey={retryingEmailKey}
          onActionSuccess={(text) => {
            setMessage(text);
            setActionError(null);
            closeOrder();
            void refresh();
          }}
          onShippingUpdate={(record) => {
            setSelectedOrderOverride((current) => current?._id === selectedOrder._id ? { ...current, shippingShipment: record ?? undefined } : current);
            void refresh();
          }}
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
