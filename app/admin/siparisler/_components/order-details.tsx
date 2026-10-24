"use client";

import { useState } from "react";
import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  PrinterIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { OrderPriceSummary } from "@/components/orders/order-price-summary";
import { ORDER_PAYMENT_STATUS_STYLES } from "@/components/orders/order-badges";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  ORDER_PAYMENT_STATUS_KEYS,
  ORDER_STATUS_KEYS,
  formatOrderCode,
  getOrderPriceBreakdown,
  orderPaymentStatusLabels,
  orderStatusLabels,
  resolveCarrierTrackingUrl,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderStatusUpdate,
} from "@/lib/orders";
import { OrderDetailsCustomer } from "./order-details-customer";
import { OrderEmailHistory } from "./order-email-history";
import type { Order, OrderEmailEvent } from "./order-admin-shared";

export function OrderDetails({
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

  const shortCode = formatOrderCode(order);
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
                  {ORDER_STATUS_KEYS.map((s) => (
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

        <OrderDetailsCustomer order={order} copiedKey={copiedKey} onCopy={copyToClipboard} />

        {/* 4. ÖNCELİK: Finansal Tutar & Hesap Özeti (Sıfır Kod Tekrarı: OrderPriceSummary) */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground pb-2 mb-2 border-b border-border">
            Ödeme ve Tutar Dökümü
          </h3>
          <OrderPriceSummary order={order} variant="admin" />
        </div>

        {/* 5. ÖNCELİK: E-posta Bildirim Kayıtları (Katlanabilir, çalışma alanını işgal etmez) */}
        <OrderEmailHistory
          order={order}
          retryingEmailKey={retryingEmailKey}
          onRetryEmail={onRetryEmail}
        />
      </DialogContent>
    </Dialog>
  );
}
