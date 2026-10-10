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
    <div className="min-w-0 p-5 bg-card rounded-xl border border-border shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, error, loading } = useAdminResource<AdminOverview>("overview");

  const orders = data?.orders ?? [];
  const totalRevenue = orders.reduce((sum, order) => sum + (Number.parseFloat(order.total) || 0), 0);
  const pendingOrdersCount = orders.filter((order) => order.status === "pending").length;

  return (
    <>
      <AdminPageHeader
        title="Genel Bakış"
        description="Mağazanızın ürün, kategori, sipariş ve ciro özetini takip edin."
      />

      {error && (
        <div className="mb-5">
          <AdminNotice kind="error">{error}</AdminNotice>
        </div>
      )}

      {loading && !data ? (
        <AdminLoading label="Mağaza özeti" variant="overview-content" />
      ) : !data ? (
        <AdminEmpty title="Özet yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyebilirsin." />
      ) : (
        <div className="space-y-6">
          <section aria-label="Mağaza ölçümleri" className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Ürün"
              value={data.productStats.total}
              note={`${data.productStats.active} satışta`}
            />
            <StatCard
              label="Kategori"
              value={data.categories.length}
              note="Mağaza menüsünde gösteriliyor"
            />
            <StatCard
              label="Sipariş"
              value={data.orders.length}
              note={`${pendingOrdersCount} işlem bekliyor`}
            />
            <StatCard
              label="Toplam ciro"
              value={formatMoney(totalRevenue)}
              note="Kayıtlı sipariş toplamı"
            />
          </section>

          <section aria-label="Son siparişler">
            <Card className="overflow-hidden rounded-xl border border-border shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Son Siparişler</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">En yeni 5 kayıt</p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <Link href={adminPath("orders")}>Tüm siparişler</Link>
                </Button>
              </div>

              {data.orders.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Henüz sipariş bulunmuyor.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.orders.slice(0, 5).map((order) => (
                    <Link
                      key={order._id}
                      href={`${adminPath("orders")}?order=${encodeURIComponent(order._id)}`}
                      className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {order.customerName || order.customerEmail}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          #{order._id.slice(-8).toUpperCase()} ·{" "}
                          {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order._creationTime))}
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
        </div>
      )}
    </>
  );
}
