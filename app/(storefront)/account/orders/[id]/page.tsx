"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft01Icon,
  ShoppingBag01Icon,
  DeliveryTruck01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Cancel01Icon,
  Location01Icon,
  CreditCardIcon,
  PackageIcon,
  PrinterIcon,
} from "hugeicons-react";
import { orderStatusLabels } from "@/lib/orders";
import { formatMoney } from "@/lib/format-money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "../../_components/order-status-badge";
import { Separator } from "@/components/ui/separator";

export default function OrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();

  const order = useQuery(
    api.orders.getOrderById,
    orderId ? { id: orderId as Id<"orders"> } : "skip"
  );

  if (order === undefined) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Sipariş detayları yükleniyor...
      </div>
    );
  }

  if (order === null) {
    return (
      <Card className="rounded-3xl border-border bg-card p-12 text-center shadow-xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Cancel01Icon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-foreground">
          Sipariş Bulunamadı
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aradığınız sipariş mevcut değil veya bu siparişi görüntüleme yetkiniz yok.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-2xl font-semibold shadow-md">
          <Link href="/account/orders">
            <ArrowLeft01Icon className="mr-2 h-4 w-4" /> Tüm Siparişlerime Dön
          </Link>
        </Button>
      </Card>
    );
  }

  const steps = [
    { key: "pending", label: "Sipariş Alındı", icon: Clock01Icon },
    { key: "paid", label: orderStatusLabels.paid, icon: CheckmarkBadge01Icon },
    { key: "shipped", label: orderStatusLabels.shipped, icon: DeliveryTruck01Icon },
    { key: "delivered", label: orderStatusLabels.delivered, icon: PackageIcon },
  ];

  const isCancelled = order.status === "cancelled";
  const currentStep = Math.max(0, steps.findIndex((step) => step.key === order.status));

  return (
    <div className="space-y-6">
      {/* Üst Navigasyon & Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/account/orders">
              <ArrowLeft01Icon className="mr-1.5 h-3.5 w-3.5" /> Tüm Siparişlerime Dön
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sipariş #{order._id.slice(-8).toUpperCase()}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Oluşturulma:{" "}
            {new Date(order._creationTime).toLocaleString("tr-TR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-xl border-border gap-2 font-medium"
          >
            <PrinterIcon className="h-4 w-4 text-muted-foreground" />
            <span>Faturayı Yazdır</span>
          </Button>
        </div>
      </div>

      {/* Durum İlerleme Çubuğu */}
      <Card className="rounded-3xl border-border bg-card p-6 shadow-xs">
        {isCancelled ? (
          <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive">
            <Cancel01Icon className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-bold text-sm">Bu sipariş iptal edilmiştir.</p>
              <p className="text-xs opacity-90">
                Detaylı bilgi için müşteri hizmetlerimizle iletişime geçebilirsiniz.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <div className="relative flex items-center justify-between">
              {/* Çizgi */}
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-muted -z-0">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />
              </div>

              {/* Adımlar */}
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={step.key} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border-2 transition-all ${
                        isPassed
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border bg-card text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/20" : ""}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`mt-2 text-center text-xs font-semibold ${
                        isPassed ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Sipariş Edilen Ürünler */}
      <Card className="rounded-3xl border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingBag01Icon className="h-5 w-5 text-primary" />
            <span>Sipariş Edilen Ürünler ({order.items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="divide-y divide-border/60">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-4 min-w-0">
                  {item.image ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                      <ShoppingBag01Icon className="h-6 w-6" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate block">
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Birim Fiyat: {formatMoney(item.price)}</span>
                      <span>•</span>
                      <span>Adet: {item.quantity}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">
                    {formatMoney(Number(item.price) * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* İki Kolonlu Bilgi Alanı: Teslimat & Ödeme Özeti */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Teslimat ve Müşteri Bilgileri */}
        <Card className="rounded-3xl border-border bg-card shadow-xs p-6 space-y-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Location01Icon className="h-5 w-5 text-primary" />
            <span>Teslimat & İletişim Bilgileri</span>
          </CardTitle>
          <Separator />

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Alıcı Ad Soyad:</span>
              <span className="font-semibold text-foreground text-sm">
                {order.customerName}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block">E-Posta Adresi:</span>
              <span className="font-medium text-foreground">
                {order.customerEmail}
              </span>
            </div>

            {order.customerPhone && (
              <div>
                <span className="text-muted-foreground block">Telefon Numarası:</span>
                <span className="font-medium text-foreground">
                  {order.customerPhone}
                </span>
              </div>
            )}

            <div>
              <span className="text-muted-foreground block">Teslimat Adresi:</span>
              <span className="font-medium text-foreground leading-relaxed mt-0.5 block">
                {order.shippingAddress || "Adres belirtilmedi"}
              </span>
            </div>
          </div>
        </Card>

        {/* Tutar & Ödeme Özeti */}
        <Card className="rounded-3xl border-border bg-card shadow-xs p-6 space-y-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5 text-primary" />
            <span>Ödeme ve Tutar Özeti</span>
          </CardTitle>
          <Separator />

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ara Toplam:</span>
              <span className="font-medium text-foreground">{formatMoney(order.total)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Kargo Ücreti:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Ücretsiz
              </span>
            </div>

            <Separator className="my-2" />

            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">Genel Toplam:</span>
              <span className="text-lg font-bold text-foreground">
                {formatMoney(order.total)}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-muted/40 p-3.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Sipariş Durumu: {order.status.toUpperCase()}</p>
              <p className="mt-0.5">Sipariş numaranız: <span className="font-mono">{order._id}</span></p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
