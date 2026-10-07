"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import { type Category, type Product } from "./_components/product-editor";

function getStockQuantity(product: Product) {
  const variants = product.variants ?? [];
  if (variants.length === 0) return product.stockQuantity ?? null;
  if (variants.some((variant) => variant.stockQuantity == null)) return null;
  return variants.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0);
}

function AdminProductsContent() {
  const { data: products, error, loading, refresh } = useAdminResource<Product[]>("products");
  const { data: categories } = useAdminResource<Category[]>("categories");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "active" | "inactive">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock" | "untracked">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasActiveFilters = Boolean(query.trim()) || categoryFilter !== "all" || availabilityFilter !== "all" || stockFilter !== "all";
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return (products || []).filter((product) => {
      const matchesTerm = !term || `${product.title} ${product.slug}`.toLocaleLowerCase("tr-TR").includes(term);
      const matchesCategory = categoryFilter === "all" || product.categorySlug === categoryFilter;
      const matchesAvailability = availabilityFilter === "all" || product.availableForSale === (availabilityFilter === "active");
      const stockQuantity = getStockQuantity(product);
      const matchesStock = stockFilter === "all"
        || (stockFilter === "in-stock" && stockQuantity !== null && stockQuantity > 0)
        || (stockFilter === "out-of-stock" && stockQuantity === 0)
        || (stockFilter === "untracked" && stockQuantity === null);
      return matchesTerm && matchesCategory && matchesAvailability && matchesStock;
    });
  }, [products, query, categoryFilter, availabilityFilter, stockFilter]);

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`“${product.title}” ürününü silmek istiyor musun?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("product.delete", undefined, product._id);
      setMessage("Ürün silindi.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Ürün silinemedi.");
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Ürünler</h1>
        <Button asChild><Link href={adminPath("products/add")}>Yeni ürün ekle</Link></Button>
      </div>
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_repeat(3,minmax(150px,1fr))_auto] sm:px-5">
          <Input aria-label="Ürün ara" name="product-search" type="search" placeholder="Ürün veya adres ara" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Kategoriye göre filtrele" name="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
            <option value="all">Tüm kategoriler</option>
            {categories?.map((category) => <option key={category._id} value={category.slug}>{category.title}</option>)}
          </select>
          <select aria-label="Yayın durumuna göre filtrele" name="availability-filter" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as typeof availabilityFilter)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
            <option value="all">Tüm yayın durumları</option>
            <option value="active">Satışta</option>
            <option value="inactive">Pasif</option>
          </select>
          <select aria-label="Stok durumuna göre filtrele" name="stock-filter" value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
            <option value="all">Tüm stok durumları</option>
            <option value="in-stock">Stokta</option>
            <option value="out-of-stock">Stokta yok</option>
            <option value="untracked">Stok takipsiz</option>
          </select>
          {hasActiveFilters && <Button type="button" variant="outline" className="h-10" onClick={() => { setQuery(""); setCategoryFilter("all"); setAvailabilityFilter("all"); setStockFilter("all"); }}>Filtreleri temizle</Button>}
        </div>

        {loading ? <div className="p-5"><AdminLoading label="Ürünler" /></div> : filteredProducts.length === 0 ? (
          <div className="p-5"><AdminEmpty title={hasActiveFilters ? "Filtrelere uyan ürün yok" : "Henüz ürün yok"} description={hasActiveFilters ? "Arama ve filtreleri değiştirip yeniden dene." : "İlk ürünü ekleyerek kataloğu oluşturmaya başlayabilirsin."} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filteredProducts.map((product) => {
              const category = categories?.find((item) => item.slug === product.categorySlug);
              const stockQuantity = getStockQuantity(product);
              return (
                <article key={product._id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_145px_120px_130px_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    {(product.images[0] || product.storageImages?.[0]?.url) ? (
                      <Image src={product.images[0] || product.storageImages?.[0]?.url || ""} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-md border border-border bg-muted object-cover" />
                    ) : (
                      <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-semibold text-muted-foreground">Ü</div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{product.title}</h3>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/product/{product.slug}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground"><span className="mr-2 text-xs text-muted-foreground lg:hidden">Kategori</span>{category?.title || "Kategorisiz"}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground"><span className="mr-2 text-xs font-normal text-muted-foreground lg:hidden">Fiyat</span>{formatMoney(product.price)}</p>
                  <p className="text-xs font-semibold"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${product.availableForSale && stockQuantity !== 0 ? "bg-primary" : "bg-muted-foreground"}`} />{!product.availableForSale ? "Pasif" : stockQuantity === 0 ? "Stokta yok" : stockQuantity == null ? "Stok takipsiz" : `Stok: ${stockQuantity}`}</p>
                  <div className="flex gap-2 lg:justify-end">
                    <Button asChild size="sm" variant="outline" className="min-h-10"><Link href={adminPath(`products/${product._id}/edit`)}>Düzenle</Link></Button>
                    <Button size="sm" variant="ghost" className="min-h-10" onClick={() => void handleDelete(product)}>Sil</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>


    </>
  );
}

export default function AdminProductsPage() {
  return <AdminProductsContent />;
}
