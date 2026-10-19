"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import { trackPixelPurchase } from "@/lib/analytics/meta-pixel";
import {
  CheckBadgeIcon,
  ShoppingBagIcon,
  MapPinIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  PrinterIcon,
  ArrowRightIcon,
  XCircleIcon,
  TruckIcon,
  BanknotesIcon,
  CreditCardIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import { OrderStatusBadge } from "@/components/orders/order-badges";
import { useCart } from "@/components/cart/cart-context";
import { clearQuickBuyItem } from "@/components/cart/quick-buy-store";
import { clearCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { OrderSuccessSkeleton } from "./order-success-skeleton";
import { getOrderCode, formatPhone } from "@/lib/orders";
import { formatDateTime } from "@/lib/format-date";
import { formatIban } from "@/lib/iban";
import { OrderPriceSummary } from "@/components/orders/order-price-summary";

export default function OrderSuccessClient({ orderId, token, quickBuy }: { orderId: string; token?: string; quickBuy: boolean }) {
  const { clearCart } = useCart();
  const { isAuthenticated } = useConvexAuth();
  const [copied, setCopied] = useState(false);
  const [copiedIban, setCopiedIban] = useState<string | null>(null);
  const clearedRef = useRef(false);

  const order = useQuery(
    api.orders.getOrderById,
    orderId ? { id: orderId, ...(token ? { token } : {}) } : "skip"
  );
  const paymentSettings = useQuery(api.payments.getPaymentSettings, {});

  // Sepet yalnızca sipariş gerçekten yüklendiğinde temizlenir; geçersiz/eski URL sepeti silmez.
  useEffect(() => {
    if (!order || clearedRef.current) return;
    clearedRef.current = true;
    if (quickBuy) {
      clearQuickBuyItem();
    } else {
      clearCart();
    }
    try {
      clearCartRecoverySessionKey();
    } catch {
      // Ignored
    }
  }, [order, quickBuy, clearCart]);

  const hasTrackedPixelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!order || order.paymentStatus !== "paid" || hasTrackedPixelRef.current === order._id) return;
    const storageKey = `meta-purchase:${order._id}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // Storage kapalıysa yalnız bu oturumda bir kez gönderilir.
    }
    hasTrackedPixelRef.current = order._id;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignored
    }

    const totalNum = Number(order.total);
    trackPixelPurchase({
      order_id: order._id,
      value: Number.isFinite(totalNum) ? totalNum : 0,
      currency: "TRY",
      num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
      content_ids: order.items.map((item) => (item.variantId ? `${item.productId}_${item.variantId}` : item.productId)),
    });
  }, [order]);

  const handleCopyIban = (iban: string) => {
    navigator.clipboard.writeText(iban).then(() => {
      setCopiedIban(iban);
      setTimeout(() => setCopiedIban(null), 2000);
    });
  };

  const orderCode = getOrderCode(order);

  const handleCopyId = () => {
    if (!orderCode) return;
    navigator.clipboard.writeText(orderCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (order === undefined) {
    return <OrderSuccessSkeleton />;
  }

  if (order === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <Card className="rounded-3xl border-border bg-card p-10 text-center shadow-xs">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <XCircleIcon className="size-8" />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Sipariş Bulunamadı
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aradığınız sipariş kaydı mevcut değil veya bu siparişi görüntüleme yetkiniz bulunmuyor.
          </p>
          <div className="mt-6">
            <Button asChild size="lg" className="rounded-2xl px-8 font-semibold shadow-xs">
              <Link href="/search">Alışverişe Devam Et</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const orderDate = formatDateTime(order._creationTime, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      {/* 1. ÜST ONAY KARTI - Proje Temasıyla Birebir Uyumlu */}
      <Card className="rounded-3xl border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckBadgeIcon className="size-8 sm:size-10" />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Teşekkür Ederiz, Siparişiniz Alındı!
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl break-words">
              Sipariş onayınız ve detaylar <span className="font-semibold text-foreground">{order.customerEmail}</span> adresine iletilecektir.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-muted-foreground">
              <span className="text-muted-foreground">Sipariş No:</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 hover:bg-muted border border-border px-2.5 py-1 rounded-xl transition-colors cursor-pointer group"
                title="Sipariş numarasını kopyala"
              >
                <span>#{orderCode}</span>
                {copied ? (
                  <CheckIcon className="size-3.5 shrink-0 text-emerald-600 print:hidden dark:text-emerald-400" />
                ) : (
                  <DocumentDuplicateIcon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground print:hidden" />
                )}
              </button>
              <span className="text-border">•</span>
              <span>{orderDate}</span>
            </div>
          </div>

          <div className="hidden lg:flex shrink-0 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2 rounded-xl border-border text-xs font-medium cursor-pointer hover:border-primary/50"
            >
              <PrinterIcon className="size-4" />
              <span>Siparişi Yazdır</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. DETAYLAR VE SİPARİŞ ÖZETİ GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SOL KOLON: Ürünler ve Teslimat Bilgileri */}
        <div className="lg:col-span-8 space-y-6">
          {/* SİPARİŞ EDİLEN ÜRÜNLER KARTI */}
          <Card className="rounded-3xl border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingBagIcon className="size-5 text-primary" />
                <span>Sipariş Edilen Ürünler</span>
              </CardTitle>
              <span className="text-xs font-medium text-muted-foreground">
                {itemsCount} Adet
              </span>
            </CardHeader>

            <CardContent className="p-6">
              <div className="space-y-4">
                {order.items.map((item, idx) => {
                  const lineTotal = Number(item.price || 0) * item.quantity;
                  return (
                    <div
                      key={`${item.productId}:${item.variantId ?? ""}:${idx}`}
                      className="flex items-center justify-between gap-4 border-b border-border/50 pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {item.image ? (
                          <div className="relative size-14 sm:size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              sizes="64px"
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                            <ShoppingBagIcon className="size-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Adet: {item.quantity} × {formatMoney(item.price)}
                          </p>
                        </div>
                      </div>

                      <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                        {formatMoney(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* TESLİMAT BİLGİLERİ KARTI */}
          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <TruckIcon className="size-5 text-primary" />
              <span>Teslimat & İletişim Bilgileri</span>
            </CardTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Alıcı Bilgileri</span>
                <p className="font-semibold text-foreground">{order.customerName}</p>
                {order.customerPhone && (
                  <p className="text-xs text-muted-foreground">{formatPhone(order.customerPhone)}</p>
                )}
                <p className="break-words text-xs text-muted-foreground">{order.customerEmail}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <MapPinIcon className="size-3.5" />
                  Teslimat Adresi
                </span>
                <p className="text-foreground leading-relaxed">
                  {order.shippingAddress || "Standart Teslimat Adresi"}
                </p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <DocumentTextIcon className="size-3.5" />
                  Fatura Bilgileri ({order.billingType === "corporate" ? "Kurumsal Fatura" : "Bireysel Fatura"})
                </span>
                {order.billingType === "corporate" ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1 text-foreground">
                    <div className="font-semibold">{order.companyName}</div>
                    <div className="text-muted-foreground">
                      {order.taxOffice} Vergi Dairesi — Vergi No/TCKN: <span className="font-mono font-medium text-foreground">{order.taxNumber}</span>
                    </div>
                    {order.billingAddress && (
                      <div className="text-muted-foreground pt-0.5">
                        <span className="font-medium text-foreground">Fatura Adresi:</span> {order.billingAddress}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-foreground leading-relaxed">
                    {order.billingAddress || order.shippingAddress || "Teslimat adresiyle aynı"}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* ÖDEME YÖNTEMİ VE TALİMATI KARTI */}
          {order.paymentMethod === "bank_transfer" && (
            <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-4">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 pb-3 border-b border-border">
                <BanknotesIcon className="size-5 text-primary" />
                <span>Havale / EFT Ödeme Talimatı</span>
              </CardTitle>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground leading-relaxed">
                <p className="font-semibold text-primary">Önemli Hatırlatma:</p>
                <p className="mt-1 text-muted-foreground">
                  Lütfen aşağıdaki banka hesaplarından birine havale/EFT yaparken açıklama kısmına yalnızca sipariş numaranızı (<span className="font-mono font-bold text-foreground">#{orderCode}</span>) yazınız. Ödemeniz onaylandığında siparişiniz işleme alınacaktır.
                </p>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Banka Hesap Bilgileri
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {(paymentSettings?.bankTransfer?.accounts ?? []).map((acc) => (
                    <div
                      key={acc.id}
                      className="rounded-xl border border-border bg-background/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-foreground text-sm block">{acc.bankName}</span>
                        <span className="text-muted-foreground">{acc.accountHolder}</span>
                        <p className="font-mono font-semibold text-foreground text-xs mt-1 select-all">
                          {formatIban(acc.iban)}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyIban(acc.iban)}
                        className="h-8 text-xs shrink-0 self-start sm:self-auto gap-1.5"
                      >
                        {copiedIban === acc.iban ? (
                          <>
                            <CheckIcon className="size-3.5 text-emerald-600" />
                            <span>Kopyalandı</span>
                          </>
                        ) : (
                          <>
                            <DocumentDuplicateIcon className="size-3.5 text-muted-foreground" />
                            <span>IBAN Kopyala</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {order.paymentMethod === "paytr" && order.paymentStatus === "pending" && (
            <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 pb-3 border-b border-border">
                <CreditCardIcon className="size-5 text-primary" />
                <span>Ödeme Onayı</span>
              </CardTitle>

              <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground text-sm">Ödeme Onayı Bekleniyor</p>
                <p>
                  Siparişiniz kaydedildi ve ürünleriniz sizin için rezerve edildi. Ödemeniz
                  onaylandığında siparişiniz işleme alınır ve size e-posta ile bildirilir.
                </p>
              </div>
            </Card>
          )}

          {order.paymentMethod === "cash_on_delivery" && (
            <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 pb-3 border-b border-border">
                <TruckIcon className="size-5 text-primary" />
                <span>Kapıda Ödeme Bilgisi</span>
              </CardTitle>

              <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  Ödeme Kapıda Tahsil Edilecektir
                </p>
                <p>
                  Sipariş tutarınız kargonuz kapınıza ulaştığında kuryeye nakit veya banka/kredi kartı ile ödenecektir.
                </p>
              </div>
            </Card>
          )}

        </div>

        {/* SAĞ KOLON: Özet & Aksiyonlar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs sticky top-24 print:static">
            <CardTitle className="text-base font-bold text-foreground pb-4 border-b border-border">
              Ödeme & Tutar Özeti
            </CardTitle>

            <div className="pt-4">
              <OrderPriceSummary order={order} variant="storefront" />
            </div>

            <div className="pt-6 space-y-2.5 print:hidden">
              <Button asChild size="lg" className="w-full rounded-2xl font-semibold gap-2 shadow-xs cursor-pointer">
                <Link href="/search">
                  <span>Alışverişe Devam Et</span>
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>

              {isAuthenticated && (
                <Button asChild variant="outline" size="lg" className="w-full rounded-2xl border-border font-medium cursor-pointer hover:border-primary/50">
                  <Link href="/account/orders">
                    <span>Siparişlerime Git</span>
                  </Link>
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="w-full rounded-xl text-xs text-muted-foreground hover:text-foreground lg:hidden"
              >
                <PrinterIcon className="size-3.5 mr-1.5" />
                <span>Siparişi Yazdır</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
