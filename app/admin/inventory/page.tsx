"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Badge, Button, Card, Input } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
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
  threshold?: number;
  productCount?: number;
  variantCount?: number;
};

const STOCK_COLUMNS = "sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.7fr)_9rem]";

export default function InventoryPage() {
  const [view, setView] = useState<"all" | "low">("all");
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

  const isLow = view === "low";
  const requestParams = { q: isLow ? "" : debouncedQuery, cursor: isLow ? "" : cursor, low: isLow ? "1" : "" };
  const { data, error, loading } = useAdminResource<StockPage>("inventory", requestParams);
  const pending = loading || (!isLow && debouncedQuery !== query.trim());
  const products = data?.page ?? [];
  const threshold = data?.threshold ?? 0;

  return (
    <>
      {error && <div className="mb-4"><AdminNotice kind="error">{error}</AdminNotice></div>}

      <div role="group" aria-label="Stok görünümü" className="mb-4 flex gap-5 border-b border-border">
        <button
          type="button"
          aria-pressed={!isLow}
          onClick={() => setView("all")}
          className={`flex min-h-10 items-center border-b-2 px-1 text-sm font-medium ${!isLow ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Tüm stok
        </button>
        <button
          type="button"
          aria-pressed={isLow}
          onClick={() => setView("low")}
          className={`flex min-h-10 items-center border-b-2 px-1 text-sm font-medium ${isLow ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Düşük stok
        </button>
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        {isLow ? (
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.productCount ?? 0} ürün, ${data.variantCount ?? 0} varyant düşük stokta (≤ ${threshold} adet).`
              : "Düşük stoklu varyantlar yükleniyor…"}
          </p>
        ) : (
          <div className="relative min-w-0">
            <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Ürün veya SKU ara"
              type="search"
              placeholder="Ürün veya SKU ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </Card>

      {loading && !data ? <AdminLoading label={isLow ? "Düşük stok" : "Stok bilgileri"} variant="list" /> : products.length === 0 ? (
        <Card className="p-5">
          <AdminEmpty
            title={isLow ? "Düşük stoklu ürün yok" : query ? "Eşleşen ürün yok" : "Stok kaydı yok"}
            description={
              isLow
                ? `Tüm varyantlar ${threshold} adedin üzerinde görünüyor.`
                : query
                  ? "Ürün adını veya SKU kodunu değiştirip tekrar ara."
                  : "Ürün eklediğinde varyant stokları burada görünür."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3" aria-busy={pending}>
          <div className={`hidden gap-2 rounded-md bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid sm:items-center sm:px-5 ${STOCK_COLUMNS}`}>
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
                {product.variants.map((variant) => {
                  const soldOut = variant.stockQuantity === 0;
                  const low = !soldOut && variant.stockQuantity <= threshold;
                  return (
                    <div key={variant.id} className={`grid gap-2 px-4 py-3 sm:items-center sm:px-5 ${STOCK_COLUMNS}`}>
                      <p className="text-sm text-foreground">{variant.title || "Tek ürün"}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{variant.sku || "SKU yok"}</p>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className={`text-sm font-semibold tabular-nums ${soldOut || low ? "text-destructive" : "text-foreground"}`}>
                          {variant.stockQuantity.toLocaleString("tr-TR")} adet
                        </span>
                        {soldOut ? (
                          <Badge variant="outline" className="rounded-md border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">Tükendi</Badge>
                        ) : low ? (
                          <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold">Düşük</Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLow && data && (cursors.length > 1 || !data.isDone) && (
        <nav aria-label="Stok sayfaları" className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={pending || cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">Sayfa {cursors.length}</span>
          <Button variant="outline" disabled={pending || data.isDone} onClick={() => setCursors((current) => [...current, data.continueCursor])}>Sonraki</Button>
        </nav>
      )}
    </>
  );
}
