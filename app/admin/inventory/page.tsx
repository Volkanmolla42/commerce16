"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";

const reasons: Record<string, string> = {
  initial_stock: "İlk stok",
  manual_adjustment: "Manuel değişiklik",
  order_reservation: "Sipariş rezervasyonu",
  reservation_release: "Rezervasyon iadesi",
  product_removed: "Ürün kaldırıldı",
};

export default function InventoryPage() {
  const { data, error, loading, refresh } = useAdminResource<Doc<"inventoryMovements">[]>("inventory-movements");

  if (loading) return <AdminLoading label="Stok hareketleri" />;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Stok hareketleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">Stok adetlerini ürünler bölümünden düzenle.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>Yenile</Button>
          <Button asChild size="sm"><Link href={adminPath("products")}>Ürünlere git</Link></Button>
        </div>
      </div>

      {error && <div className="mb-4"><AdminNotice kind="error">{error}</AdminNotice></div>}

      {!data || data.length === 0 ? (
        <AdminEmpty title="Henüz stok hareketi yok" description="Ürün stoğu değiştiğinde hareketler burada görünür." />
      ) : (
        <Card className="overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Ürün / SKU</th>
                  <th className="px-4 py-3 font-medium">Değişim</th>
                  <th className="px-4 py-3 font-medium">Neden</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Sipariş</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((movement) => (
                  <tr key={movement._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{movement.productTitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{movement.sku}{movement.variantId ? ` · ${movement.variantId}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</td>
                    <td className="px-4 py-3 text-muted-foreground">{reasons[movement.reason] ?? movement.reason}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(movement.createdAt)}</td>
                    <td className="px-4 py-3">
                      {movement.orderId ? <Link className="text-primary hover:underline" href={`${adminPath("orders")}?order=${encodeURIComponent(movement.orderId)}`}>#{movement.orderId.slice(-8).toUpperCase()}</Link> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
