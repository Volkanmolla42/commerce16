"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader, OrderStatusBadge } from "./_components/admin-primitives";
import { useAdminResource } from "./_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";

type AdminOverview = {
  productStats: { total: number; active: number };
  categories: Doc<"categories">[];
  orders: Doc<"orders">[];
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

  if (loading) return <AdminLoading label="Mağaza özeti" variant="overview" />;

  return (
    <>
      <AdminPageHeader title="Genel Bakış" description="Mağazanızın ürün, kategori, sipariş ve ciro özetini takip edin." />
      {error && <div className="mb-5"><AdminNotice kind="error">{error}</AdminNotice></div>}

      {!data ? (
        <AdminEmpty title="Özet yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyebilirsin." />
      ) : (
        <>
          <section aria-label="Mağaza ölçümleri" className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Ürün" value={data.productStats.total} note={`${data.productStats.active} satışta`} />
            <StatCard label="Kategori" value={data.categories.length} note="Mağaza menüsünde gösteriliyor" />
            <StatCard label="Sipariş" value={data.orders.length} note={`${data.orders.filter((order) => order.status === "pending").length} işlem bekliyor`} />
            <StatCard label="Toplam ciro" value={formatMoney(data.orders.reduce((sum, order) => sum + (Number.parseFloat(order.total) || 0), 0))} note="Kayıtlı sipariş toplamı" />
          </section>

          <section className="mt-6">
            <Card className="overflow-hidden rounded-lg">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Son siparişler</h2>
                  <p className="mt-1 text-xs text-muted-foreground">En yeni 5 kayıt</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={adminPath("orders")}>Tüm siparişler</Link>
                </Button>
              </div>
              {data.orders.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">Henüz sipariş yok.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.orders.slice(0, 5).map((order) => (
                    <Link key={order._id} href={`${adminPath("orders")}?order=${encodeURIComponent(order._id)}`} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{order.customerName || order.customerEmail}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">#{order._id.slice(-8).toUpperCase()} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order._creationTime))}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(order.total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

          </section>
        </>
      )}
    </>
  );
}

export default function AdminOverviewPage() {
  return <AdminOverviewContent />;
}
