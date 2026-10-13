"use client";

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
  EnvelopeIcon,
  MapPinIcon,
  PrinterIcon,
  TruckIcon,
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
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { CsvExportButton } from "../_components/export-button";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import {
  orderStatusLabels,
  getOrderCode,
  getOrderPaymentMethodTitle,
  formatWhatsAppUrl,
  resolveCarrierTrackingUrl,
  CARRIER_OPTIONS,
} from "@/lib/orders";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { adminPath } from "@/lib/admin/routes";

type Order = Doc<"orders"> & {
  emailEvents?: Doc<"orderEmailEvents">[];
};
type OrderStatus = Order["status"];
type OrderEmailEvent = Doc<"orderEmailEvents">["event"];

const statuses: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

const LIST_COLUMNS = "lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_110px_150px_88px]";

function availableStatusOptions(order: Order) {
  const options: OrderStatus[] = [order.status];
  if (order.status === "pending") {
    options.push("paid", "cancelled");
  } else if (order.status === "paid") {
    options.push("shipped", "cancelled");
  } else if (order.status === "shipped") {
    options.push("delivered", "cancelled");
  }
  return options;
}

const emailEventLabels: Record<OrderEmailEvent, string> = {
  payment_confirmation: "Ödeme ve sipariş özeti",
  admin_new_order: "Yeni sipariş bildirimi",
  order_shipped: "Kargoya verildi bildirimi",
  order_cancelled: "İptal bilgilendirmesi",
  order_delivered: "Teslimat bildirimi",
};

const emailStatusLabels: Record<Doc<"orderEmailEvents">["status"], string> = {
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  not_configured: "Resend yapılandırılmamış",
  review: "İnceleme gerekli",
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Modern Kargo Bilgisi Güncelleme Diyaloğu (window.prompt yerine)
 */
function ShippingDialog({
  order,
  onClose,
  onSubmit,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (carrier: string, trackingNumber: string) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState(order.carrier || "Yurtiçi Kargo");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(carrier.trim(), trackingNumber.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-base font-bold text-foreground">
            Kargo Bilgilerini Güncelle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="shipping-carrier" className="text-xs">
              Kargo Firması
            </Label>
            <select
              id="shipping-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Diğer">Diğer</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shipping-tracking-number" className="text-xs">
              Takip Numarası
            </Label>
            <Input
              id="shipping-tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Örn: 123456789012"
              className="h-10 font-mono text-sm"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet ve Kargola"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetails({
  order,
  onClose,
  onRetryEmail,
  retryingEmailKey,
  onUpdateStatus,
  onOpenShippingDialog,
  isUpdatingStatus,
}: {
  order: Order;
  onClose: () => void;
  onRetryEmail: (event: OrderEmailEvent) => void;
  retryingEmailKey: string | null;
  onUpdateStatus: (order: Order, status: OrderStatus, shippingInfo?: { carrier?: string; trackingNumber?: string }) => Promise<void>;
  onOpenShippingDialog: (order: Order) => void;
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

  const shortCode = getOrderCode(order);
  const whatsAppUrl = formatWhatsAppUrl(order.customerPhone);

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
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Kimliği Kopyala"
                >
                  {copiedKey === "orderId" ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                      <ClipboardDocumentCheckIcon className="size-3.5" /> Kopyalandı
                    </span>
                  ) : (
                    <ClipboardDocumentIcon className="size-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(order._creationTime, { dateStyle: "long", timeStyle: "short" })}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 gap-1.5 text-xs rounded-md cursor-pointer"
                title="Yazdır"
              >
                <PrinterIcon className="size-3.5" />
                <span>Yazdır</span>
              </Button>

              <div>
                <Label htmlFor={`modal-status-${order._id}`} className="sr-only">
                  Sipariş Durumu
                </Label>
                <select
                  id={`modal-status-${order._id}`}
                  value={order.status}
                  disabled={isUpdatingStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value as OrderStatus;
                    if (newStatus === "shipped") {
                      onOpenShippingDialog(order);
                    } else {
                      void onUpdateStatus(order, newStatus);
                    }
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus-visible:border-ring disabled:opacity-50 cursor-pointer"
                >
                  {availableStatusOptions(order).map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabels[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Kargo Bilgileri Kartı */}
          {(order.carrier || order.trackingNumber) ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <TruckIcon className="size-4 text-primary" />
                  <span>Kargo: {order.carrier || "Belirtilmedi"}</span>
                </div>
                {order.trackingNumber && (
                  <p className="mt-1 font-mono text-muted-foreground">
                    Takip No: <strong className="text-foreground">{order.trackingNumber}</strong>
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenShippingDialog(order)}
                className="h-7 text-xs cursor-pointer"
              >
                Düzenle
              </Button>
            </div>
          ) : order.status === "paid" ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Ödeme alındı. Sipariş kargolanmayı bekliyor.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onOpenShippingDialog(order)}
                className="h-7 text-xs cursor-pointer"
              >
                Kargo Girişi Yap
              </Button>
            </div>
          ) : null}

          {/* Sipariş Kalemleri */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <ShoppingBagIcon className="size-3.5" /> Ürünler ({order.items.length})
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
                          href={adminPath(`products`)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <PencilSquareIcon className="size-3" />
                          <span>Ürün</span>
                        </Link>
                        <span className="text-border text-[10px]">•</span>
                        <Link
                          href={`/search?q=${encodeURIComponent(mainTitle)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                          <ArrowTopRightOnSquareIcon className="size-3" />
                          <span>Mağaza</span>
                        </Link>
                      </div>
                    </div>

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
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Profil →
                </Link>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-foreground text-sm">{order.customerName}</p>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <a
                    href={`mailto:${order.customerEmail}`}
                    className="truncate text-foreground hover:text-primary hover:underline font-medium"
                  >
                    {order.customerEmail}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.customerEmail, "email")}
                    className="shrink-0 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                    title="Kopyala"
                  >
                    {copiedKey === "email" ? (
                      <span className="text-emerald-500 text-[11px] font-medium">Kopyalandı</span>
                    ) : (
                      <ClipboardDocumentIcon className="size-3.5" />
                    )}
                  </button>
                </div>

                {order.customerPhone && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
                    <span className="font-mono text-foreground">{order.customerPhone}</span>
                    <div className="flex items-center gap-2">
                      {whatsAppUrl && (
                        <a
                          href={whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <WhatsAppIcon className="size-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Teslimat Adresi */}
            <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" /> Teslimat Adresi
                </h3>
                {order.shippingAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.shippingAddress!, "address")}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedKey === "address" ? (
                      <span className="text-emerald-500 font-medium">Kopyalandı</span>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="size-3" />
                        <span>Kopyala</span>
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

          {/* E-posta Bildirim Durumları */}
          <section className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <EnvelopeIcon className="size-3.5" /> E-posta Bildirimleri
            </h3>
            {(order.emailEvents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Bildirim kaydı bulunmuyor.</p>
            ) : (
              (order.emailEvents ?? []).map((emailEvent) => (
                <div key={emailEvent._id} className="space-y-1.5 rounded-lg border border-border/70 bg-background/50 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{emailEventLabels[emailEvent.event]}</span>
                    <span className="text-xs text-muted-foreground">{emailStatusLabels[emailEvent.status]}</span>
                  </div>
                  {emailEvent.error && <p className="text-xs text-destructive">{emailEvent.error}</p>}
                  {(emailEvent.status === "failed" || emailEvent.status === "not_configured") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs cursor-pointer"
                      disabled={retryingEmailKey === `${order._id}:${emailEvent.event}`}
                      onClick={() => onRetryEmail(emailEvent.event)}
                    >
                      {retryingEmailKey === `${order._id}:${emailEvent.event}` ? "Deneniyor..." : "Yeniden Dene"}
                    </Button>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Finansal Tutar */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                <span className="text-muted-foreground">Ödeme Yöntemi</span>
                <span className="font-semibold text-foreground">
                  {getOrderPaymentMethodTitle(order)}
                </span>
              </div>
              {order.paymentFee !== undefined && order.paymentFee > 0 && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                  <span className="text-muted-foreground">Kapıda Ödeme Hizmet Bedeli</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    +{formatMoney(order.paymentFee)}
                  </span>
                </div>
              )}
              {order.couponCode && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                  <span className="text-muted-foreground">İndirim Kuponu ({order.couponCode})</span>
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
    return matchesTerm && (statusFilter === "all" || order.status === statusFilter);
  });

  const updateStatus = async (
    order: Order,
    status: OrderStatus,
    shippingInfo?: { carrier?: string; trackingNumber?: string }
  ) => {
    setUpdatingId(order._id);
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("order.status", { id: order._id, status, ...shippingInfo });
      setSelectedOrderOverride((prev) =>
        prev && prev._id === order._id ? { ...prev, status, ...shippingInfo } : prev
      );
      setMessage(`Sipariş ${getOrderCode(order, true)} güncellendi.`);
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
      setActionError(cause instanceof Error ? cause.message : "E-posta gönderilemedi.");
    } finally {
      setRetryingEmailKey(null);
    }
  };

  // Durum sayıları
  const counts = (orders || []).reduce<Record<string, number>>(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <>
      {(message || actionError || error) && (
        <div className="mb-4">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        {/* Filtre ve Arama Barı */}
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 sm:items-center">
          {/* Durum Sekmeleri */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <span>Tümü</span>
              <span className="font-mono text-[10px] opacity-80">{orders?.length ?? 0}</span>
            </button>
            {statuses.map((status) => {
              const count = counts[status] || 0;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${statusFilter === status
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                >
                  <span>{orderStatusLabels[status]}</span>
                  {count > 0 && <span className="font-mono text-[10px] opacity-80">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Arama Input */}
          <div className="relative min-w-0">
            <Label htmlFor="order-search" className="sr-only">
              Sipariş ara
            </Label>
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="order-search"
              name="order-search"
              type="search"
              placeholder="Sipariş kodu, müşteri veya e-posta ara..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>

          {/* CSV İndir */}
          <div className="flex items-center justify-end">
            <CsvExportButton type="orders" label="CSV İndir" />
          </div>
        </div>

        {/* Siparişler Listesi */}
        {loading ? (
          <AdminLoading label="Siparişler" variant="table" />
        ) : filteredOrders.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={query || statusFilter !== "all" ? "Eşleşen sipariş bulunamadı" : "Henüz sipariş yok"}
              description="Arama veya filtre kriterlerini değiştirip deneyin."
            />
          </div>
        ) : (
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

            {filteredOrders.map((order) => (
              <article
                key={order._id}
                className={`grid gap-4 px-4 py-4 sm:px-5 lg:items-center ${LIST_COLUMNS} hover:bg-muted/30 transition-colors`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-muted-foreground">
                    {getOrderCode(order, true)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {order.customerName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{order.customerEmail}</p>
                  <p className="truncate text-[11px] font-medium text-primary mt-0.5">
                    {getOrderPaymentMethodTitle(order)}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="mr-2 font-medium lg:hidden">Tarih</span>
                  {formatDateTime(order._creationTime, { dateStyle: "medium", timeStyle: "short" })}
                </p>

                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(order.total)}
                </p>

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
                        setShippingDialogOrder(order);
                      } else {
                        void updateStatus(order, newStatus);
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring disabled:opacity-60 cursor-pointer"
                  >
                    {availableStatusOptions(order).map((status) => (
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
                    onClick={() => openOrder(order)}
                  >
                    Detay
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

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
            await updateStatus(shippingDialogOrder, "shipped", {
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
