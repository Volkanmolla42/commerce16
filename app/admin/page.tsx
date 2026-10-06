"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { ArrowUpRight01Icon } from "hugeicons-react";
import { Button, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, OrderStatusBadge } from "./_components/admin-primitives";
import { AdminGate } from "./_components/admin-gate";
import { useAdminResource } from "./_components/admin-api";
import { formatMoney } from "@/lib/format-money";

type AdminOverview = {
  products: Doc<"products">[];
  categories: Doc<"categories">[];
  orders: Doc<"orders">[];
  pages: Doc<"pages">[];
};

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function AdminOverviewContent() {
  const { data, error, loading } = useAdminResource<AdminOverview>("overview");

  if (loading) return <AdminLoading label="Mağaza özeti" />;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Genel Bakış</h1>
      </div>
      {error && <div className="mb-5"><AdminNotice kind="error">{error}</AdminNotice></div>}

      {!data ? (
        <AdminEmpty title="Özet yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyebilirsin." />
      ) : (
        <>
          <section aria-label="Mağaza ölçümleri" className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Ürün" value={data.products.length} note={`${data.products.filter((product) => product.availableForSale).length} satışta`} />
            <StatCard label="Kategori" value={data.categories.length} note="Mağaza menüsünde gösteriliyor" />
            <StatCard label="Sipariş" value={data.orders.length} note={`${data.orders.filter((order) => order.status === "pending").length} işlem bekliyor`} />
            <StatCard label="Sayfa" value={data.pages.length} note="Yayındaki içerik sayısı" />
            <StatCard label="Toplam ciro" value={formatMoney(data.orders.reduce((sum, order) => sum + (Number.parseFloat(order.total) || 0), 0))} note="Kayıtlı sipariş toplamı" />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]">
            <Card className="overflow-hidden rounded-lg">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Son siparişler</h2>
                  <p className="mt-1 text-xs text-muted-foreground">En yeni 5 kayıt</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/orders">Tüm siparişler</Link>
                </Button>
              </div>
              {data.orders.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">Henüz sipariş yok.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.orders.slice(0, 5).map((order) => (
                    <div key={order._id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{order.customerName || order.customerEmail}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">#{order._id.slice(-8).toUpperCase()} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order._creationTime))}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(order.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden rounded-lg">
              <div className="px-4 py-3.5 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Hızlı bağlantılar</h2>
                <p className="mt-1 text-xs text-muted-foreground">Sık kullanılan yönetim alanları</p>
              </div>
              <div className="divide-y divide-border border-t border-border">
                {[
                  ["Ürün kataloğu", "/admin/products"],
                  ["Kategoriler", "/admin/categories"],
                  ["Siparişler", "/admin/orders"],
                  ["Mağaza sayfaları", "/admin/pages"],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between gap-3 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-5">
                    {label}<ArrowUpRight01Icon className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                ))}
                </div>
            </Card>
          </section>
        </>
      )}
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <AdminGate>
      <AdminOverviewContent />
    </AdminGate>
  );
}
