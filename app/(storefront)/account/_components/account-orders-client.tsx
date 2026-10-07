"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag01Icon,
  ArrowRight01Icon,
} from "hugeicons-react";
import { formatMoney } from "@/lib/format-money";
import { Button, Card, CardContent } from "@/components/ui";
import { OrderStatusBadge } from "./order-status-badge";
import { AccountLoginCard } from "./account-gate";
import { Sk, SkLine, SkField } from "./skeleton";

function AccountOrdersSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-3xl border border-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 px-6 py-4 text-xs">
            <div className="flex flex-wrap gap-6 sm:gap-10">
              <SkField label="Sipariş Tarihi" bar="h-4 w-24" />
              <SkField label="Toplam Tutar" bar="h-4 w-16" />
              <SkField label="Sipariş Numarası" bar="h-4 w-20" />
            </div>
            <div className="flex items-center gap-3">
              <Sk className="h-6 w-24 rounded-full" />
              <Sk className="h-8 w-28 rounded-xl" />
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sk className="h-12 w-12 shrink-0 rounded-xl" />
                <div className="space-y-1.5">
                  <Sk className="h-4 w-44" />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Adet:</span>
                    <SkLine className="h-3 w-6" />
                    <span>×</span>
                    <SkLine className="h-3 w-12" />
                  </p>
                </div>
              </div>
              <Sk className="h-4 w-16 shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AccountOrdersPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const orders = useQuery(api.orders.getMyOrders);

  if (!authLoading && !isAuthenticated) return <AccountLoginCard />;

  if (authLoading || orders === undefined) {
    return <AccountOrdersSkeleton />;
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
          Sipariş ve kargo bilgileri, sipariş oluşturduğunuzda burada görünür.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-2xl font-semibold shadow-md">
          <Link href="/search">
            Alışverişe Başla <ArrowRight01Icon className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  return (
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
                    {formatMoney(order.total)}
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
                <OrderStatusBadge status={order.status} />
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
                            sizes="48px"
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
                          Adet: {item.quantity} × {formatMoney(item.price)}
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-bold text-foreground whitespace-nowrap">
                      {formatMoney(Number(item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
