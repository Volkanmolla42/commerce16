"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag01Icon,
  ArrowRight01Icon,
  DeliveryTruck01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Cancel01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AccountOrdersPage() {
  const orders = useQuery(api.orders.getMyOrders);

  if (orders === undefined) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Siparişler yükleniyor...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="rounded-3xl border-border bg-card p-12 text-center shadow-xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShoppingBag01Icon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-foreground">
          Henüz kayıtlı bir siparişiniz yok
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sipariş verdiğinizde tüm detayları ve kargo takibini buradan kolayca yapabilirsiniz.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-2xl font-semibold shadow-md">
          <Link href="/search">
            Alışverişe Başla <ArrowRight01Icon className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1.5 font-medium">
            <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
            Ödeme Onaylandı
          </Badge>
        );
      case "shipped":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 gap-1.5 font-medium">
            <DeliveryTruck01Icon className="h-3.5 w-3.5" />
            Kargoya Verildi
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-medium">
            <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
            Teslim Edildi
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1.5 font-medium">
            <Cancel01Icon className="h-3.5 w-3.5" />
            İptal Edildi
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1.5 font-medium">
            <Clock01Icon className="h-3.5 w-3.5" />
            Hazırlanıyor
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Siparişlerim</h2>
        <p className="text-xs text-muted-foreground">
          Toplam {orders.length} adet siparişiniz bulunmaktadır.
        </p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card
            key={order._id}
            className="overflow-hidden rounded-3xl border-border bg-card shadow-xs transition hover:shadow-md"
          >
            {/* Kart Başlığı */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 px-6 py-4 text-xs">
              <div className="flex flex-wrap gap-6 sm:gap-10">
                <div>
                  <span className="block text-muted-foreground">Sipariş Tarihi</span>
                  <span className="font-semibold text-foreground">
                    {new Date(order._creationTime).toLocaleDateString("tr-TR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Toplam Tutar</span>
                  <span className="font-bold text-foreground">
                    ${order.total} USD
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Sipariş Numarası</span>
                  <span className="font-mono font-bold text-foreground">
                    #{order._id.slice(-8).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(order.status)}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border font-medium hover:border-primary/50"
                >
                  <Link href={`/account/orders/${order._id}`}>
                    <span>Sipariş Detayı</span>
                    <ArrowRight01Icon className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Sipariş Ürünleri Önizleme */}
            <CardContent className="p-6">
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image ? (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                          <ShoppingBag01Icon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Adet: {item.quantity} × ${item.price}
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-bold text-foreground whitespace-nowrap">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
