"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader } from "../_components/admin-primitives";
import { useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";

type StockProduct = {
  productId: string;
  title: string;
  slug: string;
  variants: Array<{
    id: string;
    title: string;
    sku?: string;
    stockQuantity: number;
  }>;
};

type StockPage = {
  page: StockProduct[];
  continueCursor: string;
  isDone: boolean;
};

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1] ?? "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCursors([null]);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const requestParams = { q: debouncedQuery, cursor };
  const { data, error, loading } = useAdminResource<StockPage>("inventory", requestParams);
  const pending = loading || debouncedQuery !== query.trim();
  const products = data?.page ?? [];

  return (
    <>
      <AdminPageHeader title="Stok" description="Ürün ve varyant stok adetleri." />

      {error && <div className="mb-4"><AdminNotice kind="error">{error}</AdminNotice></div>}

      <Card className="mb-4 p-3 sm:p-4">
        <Input
          aria-label="Ürün veya SKU ara"
          type="search"
          placeholder="Ürün veya SKU ara"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      {loading && !data ? <AdminLoading label="Stok bilgileri" variant="list" /> : products.length === 0 ? (
        <Card className="p-5">
          <AdminEmpty
            title={query ? "Eşleşen ürün yok" : "Stok kaydı yok"}
            description={query ? "Ürün adını veya SKU kodunu değiştirip tekrar ara." : "Ürün eklediğinde varyant stokları burada görünür."}
          />
        </Card>
      ) : (
        <div className="space-y-3" aria-busy={pending}>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,0.7fr)_6rem] px-5 text-xs font-medium text-muted-foreground sm:grid">
            <span>Kombinasyon</span>
            <span>SKU</span>
            <span className="text-right">Stok</span>
          </div>
          {products.map((product) => (
            <Card key={product.productId} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">{product.title}</h2>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">/product/{product.slug}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={adminPath(`products/${product.productId}/edit`)}>Ürünü düzenle</Link>
                </Button>
              </div>
              <div className="divide-y divide-border">
                {product.variants.map((variant) => (
                  <div key={variant.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.7fr)_6rem] sm:items-center sm:px-5">
                    <p className="text-sm text-foreground">{variant.title || "Tek ürün"}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{variant.sku || "SKU yok"}</p>
                    <p className={`text-sm font-semibold tabular-nums sm:text-right ${variant.stockQuantity === 0 ? "text-destructive" : "text-foreground"}`}>
                      {variant.stockQuantity.toLocaleString("tr-TR")} adet
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && (cursors.length > 1 || !data.isDone) && (
        <nav aria-label="Stok sayfaları" className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={pending || cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">Sayfa {cursors.length}</span>
          <Button variant="outline" disabled={pending || data.isDone} onClick={() => setCursors((current) => [...current, data.continueCursor])}>Sonraki</Button>
        </nav>
      )}
    </>
  );
}
