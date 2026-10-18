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
  ListBulletIcon,
  ViewColumnsIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  XMarkIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { OrdersKanban } from "./_components/orders-kanban";
import type { Doc } from "@/convex/_generated/dataModel";
import { isRetryableOrderEvent } from "@/convex/emails/events";
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
  orderPaymentStatusLabels,
  ORDER_STATUS_KEYS,
  ORDER_PAYMENT_STATUS_KEYS,
  type OrderStatus,
  type OrderPaymentStatus,
  type OrderStatusUpdate,
  getOrderCode,
  getOrderPaymentMethodTitle,
  formatWhatsAppUrl,
  formatPhone,
  resolveCarrierTrackingUrl,
  CARRIER_OPTIONS,
  getOrderPriceBreakdown,
} from "@/lib/orders";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  OrderPaymentStatusBadge,
  ORDER_PAYMENT_STATUS_STYLES,
} from "@/components/orders/order-badges";
import { OrderPriceSummary } from "@/components/orders/order-price-summary";
import { adminPath } from "@/lib/admin/routes";

type Order = Doc<"orders"> & {
  emailEvents?: Doc<"orderEmailEvents">[];
};
type OrderEmailEvent = Doc<"orderEmailEvents">["event"];

const statuses = ORDER_STATUS_KEYS;

const LIST_COLUMNS = "lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_110px_150px_88px]";

type DateRangeFilter = "all" | "today" | "yesterday" | "last7days" | "thisMonth" | "thisYear";

const dateRangeOptions: { id: DateRangeFilter; label: string }[] = [
  { id: "all", label: "Tüm Zamanlar" },
  { id: "today", label: "Bugün" },
  { id: "yesterday", label: "Dün" },
  { id: "last7days", label: "Son 7 Gün" },
  { id: "thisMonth", label: "Bu Ay" },
  { id: "thisYear", label: "Bu Yıl" },
];

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

const emailEventLabels: Record<OrderEmailEvent, string> = {
  order_placed: "Sipariş alındı bildirimi",
  payment_confirmed: "Ödeme onayı bildirimi",
  order_shipped: "Kargoya verildi bildirimi",
  order_delivered: "Teslimat bildirimi",
  order_cancelled: "İptal bilgilendirmesi",
  admin_order_alert: "Yeni sipariş bildirimi (yönetici)",
};

const emailStatusLabels: Record<Doc<"orderEmailEvents">["status"], string> = {
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  not_configured: "Resend yapılandırılmamış",
  review: "İnceleme gerekli",
};

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
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
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
            <Input
              id="shipping-carrier"
              list="carrier-options"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Örn: Aras Kargo"
              required
              autoComplete="off"
              className="h-10 text-sm"
            />
            <datalist id="carrier-options">
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
  onUpdateStatus: (
    order: Order,
    update: OrderStatusUpdate
  ) => Promise<void>;
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
  const trackingUrl = resolveCarrierTrackingUrl(order.carrier, order.trackingNumber);
  const priceBreakdown = getOrderPriceBreakdown(order);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-5 sm:p-6 space-y-4">
        {/* Header: Kimlik, Tarih, Yazdır & Durum Değiştirici */}
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
                  title="Sipariş ID Kopyala"
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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 gap-1.5 text-xs rounded-md cursor-pointer"
                title="Siparişi Yazdır"
              >
                <PrinterIcon className="size-3.5" />
                <span>Yazdır</span>
              </Button>

              {/* Lojistik Durumu */}
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`modal-status-${order._id}`} className="sr-only">
                  Lojistik Durumu
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
                      void onUpdateStatus(order, { status: newStatus });
                    }
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus-visible:border-ring disabled:opacity-50 cursor-pointer"
                  title="Lojistik Durumu"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabels[s]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ödeme Durumu */}
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`modal-payment-status-${order._id}`} className="sr-only">
                  Ödeme Durumu
                </Label>
                <select
                  id={`modal-payment-status-${order._id}`}
                  value={order.paymentStatus}
                  disabled={isUpdatingStatus}
                  onChange={(e) => {
                    const newPaymentStatus = e.target.value as OrderPaymentStatus;
                    void onUpdateStatus(order, { paymentStatus: newPaymentStatus });
                  }}
                  className={`h-8 rounded-md border px-2.5 text-xs font-semibold outline-none focus-visible:border-ring disabled:opacity-50 cursor-pointer ${ORDER_PAYMENT_STATUS_STYLES[order.paymentStatus]}`}
                  title="Finansal Ödeme Durumu"
                >
                  {ORDER_PAYMENT_STATUS_KEYS.map((paymentStatus) => (
                    <option key={paymentStatus} value={paymentStatus}>
                      {orderPaymentStatusLabels[paymentStatus]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 1. ÖNCELİK: Operasyonel Durum & Eylem Şeridi */}
        {order.paymentStatus === "pending" && order.paymentMethod === "bank_transfer" && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground">
            <div className="space-y-1">
              <p className="font-bold text-foreground">Havale / EFT Bekleniyor</p>
              <p className="text-xs text-muted-foreground">
                Hesabınıza <strong className="tabular-nums text-foreground">{formatMoney(priceBreakdown.total)}</strong> geçtiğinde ödemeyi onaylayınız.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdatingStatus}
              onClick={() => void onUpdateStatus(order, { paymentStatus: "paid" })}
              className="h-8 text-xs shrink-0 cursor-pointer"
            >
              Havale Ödemesini Onayla
            </Button>
          </div>
        )}

        {order.paymentMethod === "cash_on_delivery" && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground">Kapıda Ödeme</span>
                <span className="inline-flex items-center font-mono text-[11px] font-semibold bg-background border border-border px-2 py-0.5 rounded-md text-foreground tabular-nums">
                  Tahsil Edilecek: {formatMoney(priceBreakdown.total)}
                </span>
                {order.paymentStatus === "paid" && (
                  <span className="text-[11px] font-semibold text-emerald-500">Tahsil Edildi</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Müşteri kargocuya nakit/kart ile ödeyecektir. Teslim edildiğinde ödeme durumu otomatik &ldquo;Ödendi&rdquo; olur.
              </p>
            </div>
            {order.status !== "shipped" && order.status !== "delivered" && order.status !== "cancelled" && (
              <Button
                size="sm"
                onClick={() => onOpenShippingDialog(order)}
                className="h-8 text-xs shrink-0 cursor-pointer"
              >
                <TruckIcon className="mr-1.5 size-3.5" /> Kargo Girişi Yap
              </Button>
            )}
          </div>
        )}

        {order.status === "received" && order.paymentStatus === "paid" && order.paymentMethod !== "cash_on_delivery" && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground">
            <div className="space-y-1">
              <p className="font-bold text-foreground">Ödeme Onaylandı — Kargolanmaya Hazır</p>
              <p className="text-xs text-muted-foreground">
                Sipariş bedeli tahsil edildi. Paketleme tamamlandığında kargo firmasını ve takip numarasını girerek siparişi kargoya verin.
              </p>
            </div>
            <Button
              size="sm"
              disabled={isUpdatingStatus}
              onClick={() => onOpenShippingDialog(order)}
              className="h-8 text-xs shrink-0 cursor-pointer"
            >
              <TruckIcon className="mr-1.5 size-3.5" /> Kargola &amp; Takip No Gir
            </Button>
          </div>
        )}

        {(order.carrier || order.trackingNumber) && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TruckIcon className="size-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">{order.carrier || "Kargo"}</span>
                {order.trackingNumber && (
                  <span className="ml-2 font-mono text-muted-foreground font-semibold">
                    #{order.trackingNumber}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline text-xs"
                >
                  Kargom Nerede? →
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenShippingDialog(order)}
                className="h-7 text-xs cursor-pointer"
              >
                Kargo Bilgisini Düzenle
              </Button>
            </div>
          </div>
        )}

        {/* 2. ÖNCELİK: Sipariş Kalemleri (Paketleme & Hazırlama) */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
            <ShoppingBagIcon className="size-3.5" /> Paketlenecek Ürünler ({order.items.length})
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
                        <span className="inline-flex items-center rounded-md bg-muted text-foreground border border-border px-2 py-0.5 text-xs font-medium">
                          {variantInfo}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.quantity} adet × {formatMoney(item.price)}
                      </span>
                      {item.sku && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[11px] bg-muted/70 px-1.5 py-0.5 rounded">
                            SKU: {item.sku}
                          </span>
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

        {/* 3. ÖNCELİK: Teslimat Adresi & Müşteri İletişim (Kargo Etiketi) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Teslimat Adresi (Kargo Gönderiminin En Kritik Parçası) */}
          <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
                <MapPinIcon className="size-3.5 text-primary" /> Teslimat Adresi
              </h3>
              {order.shippingAddress && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(order.shippingAddress!, "address")}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
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
            <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
              {order.shippingAddress || "Adres belirtilmemiş."}
            </p>
          </div>

          {/* Müşteri İletişimi */}
          <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
                <EnvelopeIcon className="size-3.5 text-primary" /> Müşteri &amp; İletişim
              </h3>
              <Link
                href={adminPath(`customers?q=${encodeURIComponent(order.customerEmail)}`)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Profil →
              </Link>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-foreground text-sm">{order.customerName}</p>

              {order.customerPhone && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-medium text-foreground">
                    {formatPhone(order.customerPhone)}
                  </span>
                  {whatsAppUrl && (
                    <a
                      href={whatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground hover:text-primary transition-colors bg-muted/60 hover:bg-muted border border-border px-2 py-0.5 rounded-md"
                    >
                      <WhatsAppIcon className="size-3.5 text-emerald-500" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-border/60">
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="truncate text-muted-foreground hover:text-foreground hover:underline"
                >
                  {order.customerEmail}
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(order.customerEmail, "email")}
                  className="shrink-0 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  title="E-posta Kopyala"
                >
                  {copiedKey === "email" ? (
                    <span className="text-emerald-500 text-[11px] font-medium">Kopyalandı</span>
                  ) : (
                    <ClipboardDocumentIcon className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fatura Bilgileri (Kurumsal / Bireysel) */}
        <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <DocumentTextIcon className="size-3.5 text-primary" /> Fatura Bilgileri
              <span
                className={`ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  order.billingType === "corporate"
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {order.billingType === "corporate" ? "Kurumsal Fatura" : "Bireysel Fatura"}
              </span>
            </h3>
            {order.billingAddress && (
              <button
                type="button"
                onClick={() => copyToClipboard(order.billingAddress!, "billingAddress")}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === "billingAddress" ? (
                  <span className="text-emerald-500 font-medium">Kopyalandı</span>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="size-3" />
                    <span>Fatura Adresini Kopyala</span>
                  </>
                )}
              </button>
            )}
          </div>

          {order.billingType === "corporate" ? (
            <div className="space-y-2.5 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Firma Resmi Unvanı:</span>
                  <span className="font-semibold text-foreground text-xs leading-snug">
                    {order.companyName || "Belirtilmemiş"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Vergi No / TCKN:</span>
                  <span className="font-mono font-medium text-foreground text-xs">
                    {order.taxNumber || "Belirtilmemiş"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Vergi Dairesi:</span>
                  <span className="font-medium text-foreground">{order.taxOffice || "Belirtilmemiş"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Fatura Adresi:</span>
                  <span className="font-medium text-foreground leading-relaxed">
                    {order.billingAddress || order.shippingAddress || "Teslimat adresiyle aynı."}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
              {order.billingAddress || order.shippingAddress || "Teslimat adresiyle aynı."}
            </p>
          )}
        </div>

        {/* 4. ÖNCELİK: Finansal Tutar & Hesap Özeti (Sıfır Kod Tekrarı: OrderPriceSummary) */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground pb-2 mb-2 border-b border-border">
            Ödeme ve Tutar Dökümü
          </h3>
          <OrderPriceSummary order={order} variant="admin" />
        </div>

        {/* 5. ÖNCELİK: E-posta Bildirim Kayıtları (Katlanabilir, çalışma alanını işgal etmez) */}
        <details className="group rounded-xl border border-border bg-card/40 overflow-hidden text-xs">
          <summary className="flex items-center justify-between p-3.5 font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors">
            <span className="flex items-center gap-2">
              <EnvelopeIcon className="size-3.5" />
              <span>E-posta Bildirim Geçmişi ({(order.emailEvents ?? []).length})</span>
            </span>
            <span className="text-[10px] text-muted-foreground transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="p-3.5 pt-0 space-y-2 border-t border-border/50">
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
                  {(isRetryableOrderEvent(emailEvent.event) &&
                    (emailEvent.status === "failed" || emailEvent.status === "not_configured")) && (
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
          </div>
        </details>
      </DialogContent>
    </Dialog>
  );
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
      setMessage(`Sipariş ${getOrderCode(order, true)} güncellendi.`);
      await refresh();
      // Sunucuda türetilen alanlar (ör. teslimatta otomatik ödeme) taze veride gelir;
      // override bırakılınca modal listedeki güncel siparişi gösterir.
      setSelectedOrderOverride(null);
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
        {/* 1. Satır: Durum Sekmeleri & Sipariş Sayısı */}
        <div className="flex items-center justify-between gap-3 border-b border-border p-3 sm:px-5">
          {/* Durum Sekmeleri */}
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <span>Tümü</span>
              <span className="font-mono text-[10px] opacity-80">{baseForCounts.length}</span>
            </button>
            {statuses.map((status) => {
              const count = counts[status] || 0;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${statusFilter === status
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

          {/* CSV İndir (Sağ Taraf) */}
          <div className="shrink-0">
            <CsvExportButton type="orders" label="CSV İndir" />
          </div>
        </div>

        {/* 2. Satır: Filtreler (Sol) & Görünüm Geçişi / CSV İndir (Sağ) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-5 bg-muted/20 border-b border-border">
          {/* Sol: Kompakt Arama & Seçim Filtreleri */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Arama Input (Kompakt Genişlik) */}
            <div className="relative w-52 sm:w-64">
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
                placeholder="Sipariş no, müşteri ara..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Tarih Filtresi */}
            <div className="relative shrink-0">
              <Label htmlFor="order-date-filter" className="sr-only">
                Tarih Filtresi
              </Label>
              <CalendarDaysIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <select
                id="order-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
                className="h-9 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
              >
                {dateRangeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ödeme Yöntemi Filtresi */}
            <div className="relative shrink-0">
              <Label htmlFor="order-payment-filter" className="sr-only">
                Ödeme Yöntemi
              </Label>
              <CreditCardIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <select
                id="order-payment-filter"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
              >
                <option value="all">Tüm Ödemeler</option>
                <option value="paytr">PayTR / Kart</option>
                <option value="bank_transfer">Havale / EFT</option>
                <option value="cash_on_delivery">Kapıda Ödeme</option>
              </select>
            </div>

            {/* Ödeme Durumu (Finans) Filtresi */}
            <div className="relative shrink-0">
              <Label htmlFor="order-payment-status-filter" className="sr-only">
                Ödeme Durumu
              </Label>
              <select
                id="order-payment-status-filter"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
              >
                <option value="all">Tüm Tahsilat Durumları</option>
                {ORDER_PAYMENT_STATUS_KEYS.map((paymentStatus) => (
                  <option key={paymentStatus} value={paymentStatus}>
                    {orderPaymentStatusLabels[paymentStatus]}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtreleri Sıfırla (Aktif filtre varsa) */}
            {(dateFilter !== "all" || paymentMethodFilter !== "all" || paymentStatusFilter !== "all" || query.trim() !== "") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setDateFilter("all");
                  setPaymentMethodFilter("all");
                  setPaymentStatusFilter("all");
                  setQuery("");
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline px-1 py-1 cursor-pointer transition-colors"
              >
                <XMarkIcon className="size-3.5" />
                <span>Temizle</span>
              </button>
            )}
          </div>

          {/* Sağ: Görünüm Geçişi & Sipariş Sayısı */}
          <div className="flex items-center justify-end gap-3 shrink-0 ml-auto">
            <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-background">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${viewMode === "kanban"
                  ? "bg-muted text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
                title="Kanban Panosu"
              >
                <ViewColumnsIcon className="size-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${viewMode === "list"
                  ? "bg-muted text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
                title="Liste Görünümü"
              >
                <ListBulletIcon className="size-3.5" />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
            <div className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
              <span>{filteredOrders.length} sipariş</span>
            </div>
          </div>
        </div>

        {/* Siparişler Listesi / Kanban */}
        {loading ? (
          <AdminLoading label="Siparişler" variant="table" />
        ) : filteredOrders.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={query || statusFilter !== "all" ? "Eşleşen sipariş bulunamadı" : "Henüz sipariş yok"}
              description="Arama veya filtre kriterlerini değiştirip deneyin."
            />
          </div>
        ) : viewMode === "kanban" ? (
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
                        setShippingDialogOrder(order);
                      } else {
                        void updateStatus(order, { status: newStatus });
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
