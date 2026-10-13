"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  BanknotesIcon,
  ShoppingBagIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  TagIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PlusIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { Button, Card, Badge } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, OrderStatusBadge } from "./_components/admin-primitives";
import { useAdminResource } from "./_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";


type LowStockItem = {
  productId: string;
  title: string;
  slug: string;
  variants: Array<{
    id: string;
    title: string;
    stockQuantity: number;
    sku?: string;
  }>;
};

type AdminOverview = {
  productStats: { total: number; active: number };
  categories: Doc<"categories">[];
  orders: Doc<"orders">[];
  lowStock: {
    threshold: number;
    productCount: number;
    variantCount: number;
    items?: LowStockItem[];
  };
};

export default function AdminOverviewPage() {
  const { data, error, loading } = useAdminResource<AdminOverview>("overview");

  const orders = data?.orders ?? [];
  const totalRevenue = orders.reduce((sum, order) => sum + (Number.parseFloat(order.total) || 0), 0);
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const paidOrders = orders.filter((order) => order.status === "paid");
  const shippedOrders = orders.filter((order) => order.status === "shipped");
  const deliveredOrders = orders.filter((order) => order.status === "delivered");
  const cancelledOrders = orders.filter((order) => order.status === "cancelled");

  return (
    <>
      {error && (
        <div className="mb-5">
          <AdminNotice kind="error">{error}</AdminNotice>
        </div>
      )}

      {loading && !data ? (
        <AdminLoading label="Mağaza özeti" variant="overview-content" />
      ) : !data ? (
        <AdminEmpty title="Özet yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." />
      ) : (
        <div className="space-y-6">
          {/* Hızlı Eylem Kısayolları */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hızlı İşlemler:
              </span>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 cursor-pointer">
                <Link href={adminPath("orders")}>
                  <ShoppingBagIcon className="size-3.5" />
                  <span>Siparişler</span>
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 cursor-pointer">
                <Link href={adminPath("inventory")}>
                  <ArchiveBoxIcon className="size-3.5" />
                  <span>Stok Yönetimi</span>
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 cursor-pointer">
                <Link href={adminPath("coupons")}>
                  <TagIcon className="size-3.5" />
                  <span>Kuponlar</span>
                </Link>
              </Button>
            </div>

            <Button asChild size="sm" className="h-8 text-xs gap-1 cursor-pointer">
              <Link href={adminPath("products")}>
                <PlusIcon className="size-3.5" />
                <span>Ürün Yönetimi</span>
              </Link>
            </Button>
          </div>

          {/* Eyleme Geçilebilir Temel Metrik Kartları */}
          <section aria-label="Mağaza göstergeleri" className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Toplam Ciro */}
            <Link
              href={adminPath("orders")}
              className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:shadow-xs flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Toplam Ciro</span>
                <div className="rounded-lg bg-muted p-1.5 text-muted-foreground group-hover:text-primary transition-colors">
                  <BanknotesIcon className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {formatMoney(totalRevenue)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {orders.length} sipariş kaydı
                </p>
              </div>
            </Link>

            {/* Bekleyen Siparişler */}
            <Link
              href={adminPath("orders")}
              className={`group rounded-xl border bg-card p-4 transition-all hover:shadow-xs flex flex-col justify-between cursor-pointer ${
                pendingOrders.length > 0
                  ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Bekleyen Siparişler</span>
                <div
                  className={`rounded-lg p-1.5 transition-colors ${
                    pendingOrders.length > 0
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ShoppingBagIcon className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {pendingOrders.length}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pendingOrders.length > 0 ? "İşlem ve kargo bekliyor" : "Tüm siparişler güncel"}
                </p>
              </div>
            </Link>

            {/* Satıştaki Ürünler */}
            <Link
              href={adminPath("products")}
              className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:shadow-xs flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Satıştaki Ürünler</span>
                <div className="rounded-lg bg-muted p-1.5 text-muted-foreground group-hover:text-primary transition-colors">
                  <CubeIcon className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {data.productStats.active}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Toplam {data.productStats.total} katalog ürünü
                </p>
              </div>
            </Link>

            {/* Düşük Stok Uyarısı */}
            <Link
              href={`${adminPath("inventory")}?low=1`}
              className={`group rounded-xl border bg-card p-4 transition-all hover:shadow-xs flex flex-col justify-between cursor-pointer ${
                data.lowStock.productCount > 0
                  ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Kritik Stok</span>
                <div
                  className={`rounded-lg p-1.5 transition-colors ${
                    data.lowStock.productCount > 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ExclamationTriangleIcon className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {data.lowStock.productCount}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.lowStock.productCount > 0
                    ? `${data.lowStock.variantCount} varyant ≤ ${data.lowStock.threshold} adet`
                    : "Tüm stoklar yeterli"}
                </p>
              </div>
            </Link>
          </section>

          {/* İki Kolonlu Operasyonel Alan */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SOL KOLON: Son Siparişler (2 Birim Genişlik) */}
            <section aria-label="Son siparişler" className="lg:col-span-2">
              <Card className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-muted/20">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Son Siparişler</h2>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1 cursor-pointer">
                    <Link href={adminPath("orders")}>
                      <span>Tümü ({orders.length})</span>
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </Button>
                </div>

                {orders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Henüz sipariş kaydı bulunmuyor.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {orders.slice(0, 6).map((order) => (
                      <Link
                        key={order._id}
                        href={`${adminPath("orders")}?order=${encodeURIComponent(order._id)}`}
                        className="flex flex-col gap-2.5 px-5 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              #{order._id.slice(-8).toUpperCase()}
                            </span>
                            <span className="truncate text-sm font-medium text-foreground">
                              {order.customerName || order.customerEmail}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(
                              new Date(order._creationTime)
                            )}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <OrderStatusBadge status={order.status} />
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {formatMoney(order.total)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            {/* SAĞ KOLON: Operasyon Durumu & Kritik Stoklar (1 Birim Genişlik) */}
            <div className="space-y-6">
              {/* Sipariş Durum Dağılımı */}
              <Card className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border px-5 py-3.5 bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground">Sipariş Dağılımı</h2>
                </div>
                <div className="divide-y divide-border text-xs">
                  <Link
                    href={adminPath("orders")}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground">Bekleyen</span>
                    <span className="font-semibold tabular-nums text-foreground">{pendingOrders.length}</span>
                  </Link>
                  <Link
                    href={adminPath("orders")}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground">Ödenen</span>
                    <span className="font-semibold tabular-nums text-foreground">{paidOrders.length}</span>
                  </Link>
                  <Link
                    href={adminPath("orders")}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground">Kargolanan</span>
                    <span className="font-semibold tabular-nums text-foreground">{shippedOrders.length}</span>
                  </Link>
                  <Link
                    href={adminPath("orders")}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground">Teslim Edilen</span>
                    <span className="font-semibold tabular-nums text-foreground">{deliveredOrders.length}</span>
                  </Link>
                  {cancelledOrders.length > 0 && (
                    <Link
                      href={adminPath("orders")}
                      className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <span className="text-muted-foreground">İptal Edilen</span>
                      <span className="font-semibold tabular-nums text-muted-foreground">{cancelledOrders.length}</span>
                    </Link>
                  )}
                </div>
              </Card>

              {/* Kritik Stok Takibi */}
              <Card className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground">Kritik Stok Uyarısı</h2>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2 cursor-pointer">
                    <Link href={`${adminPath("inventory")}?low=1`}>Yönet</Link>
                  </Button>
                </div>

                {data.lowStock.productCount === 0 ? (
                  <div className="p-5 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <CheckCircleIcon className="size-4 text-emerald-600 shrink-0" />
                    <span>Tüm ürün stokları yeterli seviyede.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {(data.lowStock.items || []).slice(0, 4).map((item) => (
                      <Link
                        key={item.productId}
                        href={`${adminPath("inventory")}?q=${encodeURIComponent(item.slug)}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.variants.map((v) => `${v.title}: ${v.stockQuantity} adet`).join(", ")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-destructive/30 bg-destructive/10 text-destructive font-semibold">
                          Azaldı
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
