"use client"
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
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
import { CsvExportButton } from "../_components/export-button";
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

const LIST_COLUMNS = "lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_110px_150px_88px]";

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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function OrderDetails({
  order,
  onClose,
  onRetryEmail,
  retryingEmailKey,
  onUpdateStatus,
  isUpdatingStatus,
}: {
  order: Order;
  onClose: () => void;
  onRetryEmail: (event: OrderEmailEvent) => void;
  retryingEmailKey: string | null;
  onUpdateStatus: (order: Order, status: OrderStatus) => Promise<void>;
  isUpdatingStatus: boolean;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const shortCode = order._id.slice(-8).toUpperCase();

  const getWhatsAppUrl = (phone: string | undefined) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    const formatted = digits.startsWith("0")
      ? `9${digits}`
      : digits.startsWith("90")
      ? digits
      : digits.length === 10
      ? `90${digits}`
      : digits;
    return `https://wa.me/${formatted}`;
  };

  const whatsAppUrl = getWhatsAppUrl(order.customerPhone);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-5 sm:p-6">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground font-mono">
                  Sipariş #{shortCode}
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => copyToClipboard(order._id, "orderId")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Sipariş kimliğini kopyala"
                >
                  {copiedKey === "orderId" ? (
                    <span className="flex items-center gap-1 text-[11px] font-sans text-emerald-500 font-medium">
                      <ClipboardDocumentCheckIcon className="size-3.5" /> Kopyalandı
                    </span>
                  ) : (
                    <ClipboardDocumentIcon className="size-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" }).format(new Date(order._creationTime))}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 gap-1.5 text-xs rounded-md"
                title="Sipariş fişini yazdır"
              >
                <PrinterIcon className="size-3.5" />
                <span>Yazdır</span>
              </Button>

              <div>
                <Label htmlFor={`modal-status-${order._id}`} className="sr-only">Sipariş Durumu</Label>
                <select
                  id={`modal-status-${order._id}`}
                  value={order.status}
                  disabled={isUpdatingStatus}
                  onChange={(e) => void onUpdateStatus(order, e.target.value as OrderStatus)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus-visible:border-ring disabled:opacity-50 cursor-pointer"
                >
                  {availableStatusOptions(order).map((s) => (
                    <option key={s} value={s}>{orderStatusLabels[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Sipariş Edilen Ürünler */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <ShoppingBagIcon className="size-3.5" /> Sipariş Edilen Ürünler ({order.items.length})
            </h3>

            <div className="divide-y divide-border rounded-xl border border-border bg-card/60 overflow-hidden">
              {order.items.map((item, index) => {
                const parts = item.title.split("—");
                const mainTitle = parts[0]?.trim() || item.title;
                const variantInfo = parts.length > 1 ? parts.slice(1).join("—").trim() : null;

                return (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex items-center gap-3.5 p-3.5 text-sm hover:bg-muted/20 transition-colors"
                  >
                    {/* Ürün Görseli */}
                    {item.image ? (
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <ShoppingBagIcon className="size-5 opacity-40" />
                      </div>
                    )}

                    {/* Ürün Bilgileri ve Aksiyonlar */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground text-sm leading-snug line-clamp-1">
                          {mainTitle}
                        </p>
                        {variantInfo && (
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                            {variantInfo}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                        <span>{item.quantity} adet × {formatMoney(item.price)}</span>
                        {item.sku && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px]">SKU: {item.sku}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 pt-0.5 text-xs">
                        <Link
                          href={adminPath(`products/${item.productId}/edit`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <PencilSquareIcon className="size-3" />
                          <span>Ürünü Düzenle</span>
                        </Link>
                        <span className="text-border text-[10px]">•</span>
                        <Link
                          href={`/search?q=${encodeURIComponent(mainTitle)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                          <ArrowTopRightOnSquareIcon className="size-3" />
                          <span>Mağazada Gör</span>
                        </Link>
                      </div>
                    </div>

                    {/* Satır Tutarı */}
                    <div className="shrink-0 text-right pl-2">
                      <p className="font-bold tabular-nums text-foreground text-sm">
                        {formatMoney(Number(item.price) * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* İki Kolon: Müşteri & Teslimat */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {/* Müşteri Bilgileri */}
            <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
                  <EnvelopeIcon className="size-3.5" /> Müşteri
                </h3>
                <Link
                  href={adminPath(`customers?q=${encodeURIComponent(order.customerEmail)}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Müşteri Profili →
                </Link>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-foreground text-sm">{order.customerName}</p>

                {/* Mailto Linki ve Kopyalama */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <a
                    href={`mailto:${order.customerEmail}`}
                    className="truncate text-foreground hover:text-primary hover:underline font-medium flex items-center gap-1.5"
                    title="E-posta gönder"
                  >
                    <span>{order.customerEmail}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.customerEmail, "email")}
                    className="shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                    title="E-postayı kopyala"
                  >
                    {copiedKey === "email" ? (
                      <span className="text-emerald-500 text-[11px] font-medium">Kopyalandı</span>
                    ) : (
                      <ClipboardDocumentIcon className="size-3.5" />
                    )}
                  </button>
                </div>

                {/* Telefon, WhatsApp ve Kopyalama */}
                {order.customerPhone && (
                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <div className="flex items-center gap-2 truncate">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="text-foreground hover:text-primary hover:underline font-medium flex items-center gap-1"
                        title="Telefonla ara"
                      >
                        <PhoneIcon className="size-3 text-muted-foreground" />
                        <span>{order.customerPhone}</span>
                      </a>

                      {whatsAppUrl && (
                        <a
                          href={whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="WhatsApp ile mesaj gönder"
                        >
                          <WhatsAppIcon className="size-3 fill-current" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(order.customerPhone!, "phone")}
                      className="shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                      title="Telefonu kopyala"
                    >
                      {copiedKey === "phone" ? (
                        <span className="text-emerald-500 text-[11px] font-medium">Kopyalandı</span>
                      ) : (
                        <ClipboardDocumentIcon className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Teslimat Bilgileri */}
            <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" /> Teslimat
                </h3>
                {order.shippingAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.shippingAddress!, "address")}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === "address" ? (
                      <span className="text-emerald-500 font-medium">Kopyalandı</span>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="size-3" />
                        <span>Adresi Kopyala</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {order.shippingAddress || "Adres belirtilmemiş."}
              </p>
            </div>
          </div>

          {/* E-posta Bildirimleri */}
          <section className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <EnvelopeIcon className="size-3.5" /> E-posta Bildirimleri
            </h3>
            {(order.emailEvents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Bu sipariş için henüz bildirim kaydı yok.</p>
            ) : (
              (order.emailEvents ?? []).map((emailEvent) => (
                <div key={emailEvent._id} className="space-y-1.5 rounded-lg border border-border/70 bg-background/50 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{emailEventLabels[emailEvent.event]}</span>
                    <span className="text-xs text-muted-foreground">{emailStatusLabels[emailEvent.status]}</span>
                  </div>
                  {emailEvent.error && <p className="text-xs text-destructive">{emailEvent.error}</p>}
                  {emailEvent.status === "review" && (
                    <p className="text-xs text-muted-foreground">Mükerrer gönderimi önlemek için tekrar kapalı. Resend panelinde kontrol edin.</p>
                  )}
                  {(emailEvent.status === "failed" || emailEvent.status === "not_configured") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={retryingEmailKey === `${order._id}:${emailEvent.event}`}
                      onClick={() => onRetryEmail(emailEvent.event)}
                    >
                      {retryingEmailKey === `${order._id}:${emailEvent.event}` ? "Kuyruğa alınıyor…" : "E-postayı yeniden dene"}
                    </Button>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Finansal Özet (Tek ve Temiz) */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex flex-col gap-2">
              {order.couponCode && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                  <span className="text-muted-foreground">Kupon İndirimi ({order.couponCode})</span>
                  <span className="font-semibold tabular-nums text-emerald-500">
                    −{formatMoney((order.couponDiscountKurus ?? 0) / 100)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Toplam Tutar</span>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatMoney(order.total)}
                </span>
              </div>
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

  const term = query.trim().toLocaleLowerCase("tr-TR");
  const filteredOrders = (orders || []).filter((order) => {
    const matchesTerm = !term || `${order._id} ${order.customerName} ${order.customerEmail}`.toLocaleLowerCase("tr-TR").includes(term);
    return matchesTerm && (statusFilter === "all" || order.status === statusFilter);
  });

  const updateStatus = async (order: Order, status: OrderStatus) => {
    setUpdatingId(order._id);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("order.status", { id: order._id, status });
      setSelectedOrderOverride((prev) => (prev && prev._id === order._id ? { ...prev, status } : prev));
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
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:px-5">
          <div className="relative min-w-0"><Label htmlFor="order-search" className="sr-only">Sipariş ara</Label><MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="order-search" name="order-search" type="search" placeholder="Sipariş, müşteri veya e-posta ara" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
          <div><Label htmlFor="order-status-filter" className="sr-only">Duruma göre filtrele</Label><select id="order-status-filter" name="status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring"><option value="all">Tüm durumlar</option>{statuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select></div>
          <div className="flex items-center justify-end"><CsvExportButton type="orders" label="Siparişleri CSV olarak indir" /></div>
        </div>

        {loading ? <AdminLoading label="Siparişler" variant="table" /> : filteredOrders.length === 0 ? (
          <div className="p-5"><AdminEmpty title={query || statusFilter !== "all" ? "Eşleşen sipariş yok" : "Henüz sipariş yok"} description={query || statusFilter !== "all" ? "Arama veya durum filtresini değiştirip yeniden dene." : "Siparişler geldikçe burada görünecek."} /></div>
        ) : (
          <div className="divide-y divide-border">
            <div className={`hidden gap-4 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-5 lg:grid lg:items-center ${LIST_COLUMNS}`}>
              <span>Sipariş</span>
              <span>Tarih</span>
              <span>Tutar</span>
              <span>Durum</span>
              <span className="text-right">İşlem</span>
            </div>
            {filteredOrders.map((order) => (
              <article key={order._id} className={`grid gap-4 px-4 py-4 sm:px-5 lg:items-center ${LIST_COLUMNS}`}>
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
                <Button variant="outline" className="min-h-10 lg:justify-self-end" onClick={() => openOrder(order)}>Detay</Button>
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
          onUpdateStatus={updateStatus}
          isUpdatingStatus={updatingId === selectedOrder._id}
        />
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <>
      <Suspense fallback={<AdminLoading label="Siparişler" variant="table" />}>
        <AdminOrdersContent />
      </Suspense>
    </>
  );
}
