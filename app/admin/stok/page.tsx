"use client";

import { routes } from "@/lib/storefront-routes";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminActionNotice, AdminEmpty, AdminListCard, AdminPagination, AdminSearchField } from "../_components/admin-primitives";
import { ExportMenu } from "../_components/export-button";
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
  truncated?: boolean;
};

const STOCK_COLUMNS = "lg:grid-cols-[minmax(0,1.5fr)_130px_100px_90px_88px]";

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
  const requestParams = {
    q: isLow ? "" : debouncedQuery,
    cursor: isLow ? "" : cursor,
    low: isLow ? "1" : "",
  };

  const { data, error, loading } = useAdminResource<StockPage>("inventory", requestParams);
  const pending = loading || debouncedQuery !== query.trim();
  const rawProducts = data?.page ?? [];
  const products = isLow && debouncedQuery
    ? rawProducts.filter((product) => {
        const q = debouncedQuery.toLowerCase();
        return (
          product.title.toLowerCase().includes(q) ||
          product.variants.some(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              (v.sku && v.sku.toLowerCase().includes(q))
          )
        );
      })
    : rawProducts;
  const threshold = data?.threshold ?? 3;

  return (
    <>
      <AdminActionNotice error={error} />

      <AdminListCard
        loading={loading}
        loadingLabel="Stok durumu"
        empty={
          products.length === 0 ? (
            <AdminEmpty
              title={query ? "Eşleşen ürün bulunamadı" : isLow ? "Kritik stokta ürün yok" : "Stok kaydı yok"}
              description={
                query
                  ? "Arama terimini değiştirip yeniden deneyin."
                  : isLow
                  ? `Tüm ürünlerin stokları ${threshold} adedin üzerindedir.`
                  : "Ürün eklediğinizde varyant stokları burada listelenir."
              }
            />
          ) : null
        }
        footer={
          !isLow && data ? (
            <AdminPagination
              page={cursors.length}
              hasNext={!data.isDone}
              nextCursor={data.continueCursor}
              pending={pending}
              onPrevious={() => setCursors((current) => current.slice(0, -1))}
              onNext={(nextCursor) => setCursors((current) => [...current, nextCursor])}
            />
          ) : null
        }
        toolbar={
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 sm:items-center">
            {/* Sekmeler */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setView("all");
                  setCursors([null]);
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  !isLow
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArchiveBoxIcon className="size-3.5" />
                <span>Tüm Stok</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("low");
                  setCursors([null]);
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isLow
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ExclamationTriangleIcon className="size-3.5 text-amber-500" />
                <span>Kritik Stok</span>
                {data?.productCount !== undefined && data.productCount > 0 && (
                  <span className="rounded-full bg-destructive/15 text-destructive px-1.5 py-0.2 text-[10px] font-mono font-bold">
                    {data.productCount}
                  </span>
                )}
              </button>
            </div>

            <AdminSearchField
              id="inventory-search"
              label="Ürün veya SKU ara"
              placeholder="Ürün adı veya SKU kodu ara..."
              value={query}
              onChange={setQuery}
            />

            {/* Eşik Bilgisi */}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground font-mono">Eşik: ≤ {threshold} adet</span>
              {isLow && data?.truncated ? (
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  Tarama son 500 ürünle sınırlı
                </span>
              ) : null}
              <ExportMenu type="inventory" />
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border">
          {/* Masaüstü Başlık */}
          <div
            className={`hidden gap-4 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-5 lg:grid lg:items-center ${STOCK_COLUMNS}`}
          >
            <span>Ürün & Varyant</span>
            <span>SKU Kodu</span>
            <span>Kalan Stok</span>
            <span>Durum</span>
            <span className="text-right">İşlem</span>
          </div>

          {/* Ürün & Varyant Grupları */}
          {products.map((product) => (
              <div key={product.productId} className="divide-y divide-border/60">
                {product.variants.map((variant) => {
                  const soldOut = variant.stockQuantity === 0;
                  const low = !soldOut && variant.stockQuantity <= threshold;

                  return (
                    <article
                      key={variant.id}
                      className={`grid gap-4 px-4 py-3 sm:px-5 lg:items-center ${STOCK_COLUMNS} hover:bg-muted/30 transition-colors`}
                    >
                      {/* Ürün & Varyant Başlığı */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {product.title}
                          </span>
                          <a
                            href={routes.product(product.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground p-0.5"
                            title="Mağazada Gör"
                          >
                            <ArrowTopRightOnSquareIcon className="size-3" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {variant.title && variant.title !== "Default Title" ? variant.title : "Standart Seçenek"}
                        </p>
                      </div>

                      {/* SKU */}
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {variant.sku || "—"}
                        </span>
                      </div>

                      {/* Stok Miktarı */}
                      <div>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            soldOut
                              ? "text-destructive"
                              : low
                              ? "text-amber-700 dark:text-amber-400 font-bold"
                              : "text-foreground"
                          }`}
                        >
                          {variant.stockQuantity.toLocaleString("tr-TR")} adet
                        </span>
                      </div>

                      {/* Durum Rozeti */}
                      <div>
                        {soldOut ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-destructive text-[11px] font-semibold"
                          >
                            Tükendi
                          </Badge>
                        ) : low ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-semibold"
                          >
                            Azaldı
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-muted text-muted-foreground text-[11px] font-medium"
                          >
                            Yeterli
                          </Badge>
                        )}
                      </div>

                      {/* İşlem */}
                      <div className="flex items-center justify-end">
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs cursor-pointer">
                          <Link href={adminPath(`products/${product.productId}/edit`)}>
                            <PencilSquareIcon className="size-3.5" />
                            <span>Düzenle</span>
                          </Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
        </div>
      </AdminListCard>
    </>
  );
}
