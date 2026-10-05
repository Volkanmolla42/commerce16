"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeading, OrderStatusBadge } from "./_components/admin-primitives";
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
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-neutral-950">{value}</p>
      <p className="mt-1.5 truncate text-xs text-neutral-500">{note}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, error, loading, refresh } = useAdminResource<AdminOverview>("overview");

  if (loading) return <AdminLoading label="Mağaza özeti" />;

  return (
    <>
      <AdminPageHeading
        title="Genel Bakış"
        description="Ürün, kategori, sipariş ve içerik durumunu tek ekranda izle."
        action={<Button variant="outline" className="rounded-md border-neutral-200 bg-white shadow-none hover:bg-neutral-50" onClick={() => void refresh()}>Yenile</Button>}
      />

      {error && <div className="mb-5"><AdminNotice kind="error">{error}</AdminNotice></div>}

      {!data ? (
        <AdminEmpty title="Özet yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyebilirsin." />
      ) : (
        <>
          <section aria-label="Mağaza ölçümleri" className="grid grid-cols-2 divide-x divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Ürün" value={data.products.length} note={`${data.products.filter((product) => product.availableForSale).length} satışta`} />
            <StatCard label="Kategori" value={data.categories.length} note="Mağaza menüsünde gösteriliyor" />
            <StatCard label="Sipariş" value={data.orders.length} note={`${data.orders.filter((order) => order.status === "pending").length} işlem bekliyor`} />
            <StatCard label="Sayfa" value={data.pages.length} note="Yayındaki içerik sayısı" />
            <StatCard label="Toplam ciro" value={formatMoney(data.orders.reduce((sum, order) => sum + (Number.parseFloat(order.total) || 0), 0))} note="Kayıtlı sipariş toplamı" />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]">
            <Card className="overflow-hidden rounded-lg border-neutral-200 bg-white shadow-none">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950">Son siparişler</h2>
                  <p className="mt-1 text-xs text-neutral-500">En yeni 5 kayıt</p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-md border-neutral-200 bg-white shadow-none hover:bg-neutral-50">
                  <Link href="/admin/orders">Tüm siparişler</Link>
                </Button>
              </div>
              {data.orders.length === 0 ? (
                <div className="p-5 text-sm text-neutral-500">Henüz sipariş yok.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {data.orders.slice(0, 5).map((order) => (
                    <div key={order._id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-950">{order.customerName || order.customerEmail}</p>
                        <p className="mt-1 truncate text-xs text-neutral-500">#{order._id.slice(-8).toUpperCase()} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(order._creationTime))}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-semibold tabular-nums text-neutral-950">{formatMoney(order.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden rounded-lg border-neutral-200 bg-white shadow-none">
              <div className="px-4 py-3.5 sm:px-5">
                <h2 className="text-sm font-semibold text-neutral-950">Hızlı bağlantılar</h2>
                <p className="mt-1 text-xs text-neutral-500">Sık kullanılan yönetim alanları</p>
              </div>
              <div className="divide-y divide-neutral-100 border-t border-neutral-200">
                {[
                  ["Ürün kataloğu", "/admin/products"],
                  ["Kategoriler", "/admin/categories"],
                  ["Siparişler", "/admin/orders"],
                  ["Mağaza sayfaları", "/admin/pages"],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between gap-3 px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950 sm:px-5">
                    {label}<span aria-hidden="true" className="text-neutral-400">↗</span>
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
