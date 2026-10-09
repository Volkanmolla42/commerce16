"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import { type Category } from "./_components/product-editor";

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: string;
  categorySlug?: string;
  availableForSale: boolean;
  images: string[];
};
type ProductPage = { items: Product[]; continueCursor: string; isDone: boolean };

function AdminProductsContent() {
  const { data: categories } = useAdminResource<Category[]>("categories");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "active" | "inactive">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasActiveFilters = Boolean(query.trim()) || categoryFilter !== "all" || availabilityFilter !== "all";
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1] ?? "";
  const [requestParams, setRequestParams] = useState<Record<string, string>>({ q: "", category: "all", availability: "all", cursor: "" });
  useEffect(() => {
    const timer = setTimeout(() => setRequestParams({
      q: query, category: categoryFilter, availability: availabilityFilter, cursor,
    }), 250);
    return () => clearTimeout(timer);
  }, [query, categoryFilter, availabilityFilter, cursor]);
  const { data, error, loading, refresh } = useAdminResource<ProductPage>("products", requestParams);
  const filteredProducts = data?.items ?? [];
  const pending = loading || requestParams.q !== query || requestParams.category !== categoryFilter ||
    requestParams.availability !== availabilityFilter || requestParams.cursor !== cursor;

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
      <AdminPageHeader title="Ürünler" description="Ürün kataloğunu görüntüleyin, filtreleyin ve ürün bilgilerini yönetin." actions={<Button asChild><Link href={adminPath("products/add")}>Yeni ürün ekle</Link></Button>} />
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_repeat(2,minmax(150px,1fr))_auto] sm:px-5">
          <Input aria-label="Ürün ara" name="product-search" type="search" placeholder="Ürün veya adres ara" value={query} onChange={(event) => { setQuery(event.target.value); setCursors([null]); }} />
          <select aria-label="Kategoriye göre filtrele" name="category-filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCursors([null]); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
            <option value="all">Tüm kategoriler</option>
            {categories?.map((category) => <option key={category._id} value={category.slug}>{category.title}</option>)}
          </select>
          <select aria-label="Yayın durumuna göre filtrele" name="availability-filter" value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value as typeof availabilityFilter); setCursors([null]); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
            <option value="all">Tüm yayın durumları</option>
            <option value="active">Satışta</option>
            <option value="inactive">Pasif</option>
          </select>
          {hasActiveFilters && <Button type="button" variant="outline" className="h-10" onClick={() => { setQuery(""); setCategoryFilter("all"); setAvailabilityFilter("all"); setCursors([null]); }}>Filtreleri temizle</Button>}
        </div>

        <p aria-live="polite" className="px-4 pt-3 text-sm text-muted-foreground">{pending ? "Ürünler yükleniyor…" : `Bu sayfada ${filteredProducts.length} ürün`}</p>
        {loading ? <AdminLoading label="Ürünler" variant="table" /> : filteredProducts.length === 0 ? (
          <div className="p-5"><AdminEmpty title={!data?.isDone ? "Bu sayfada eşleşen ürün yok" : hasActiveFilters ? "Filtrelere uyan ürün yok" : "Henüz ürün yok"} description={!data?.isDone ? "Sonraki sayfayı inceleyebilirsiniz." : hasActiveFilters ? "Arama ve filtreleri değiştirip yeniden dene." : "İlk ürünü ekleyerek kataloğu oluşturmaya başlayabilirsin."} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filteredProducts.map((product) => {
              const category = categories?.find((item) => item.slug === product.categorySlug);
              return (
                <article key={product._id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_145px_120px_100px_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    {product.images[0] ? (
                      <Image src={product.images[0]} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-md border border-border bg-muted object-cover" />
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
                  <p className="text-xs font-semibold"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${product.availableForSale ? "bg-primary" : "bg-muted-foreground"}`} />{product.availableForSale ? "Satışta" : "Pasif"}</p>
                  <div className="flex gap-2 lg:justify-end">
                    <Button asChild size="sm" variant="outline" className="min-h-10"><Link href={adminPath(`products/${product._id}/edit`)}>Düzenle</Link></Button>
                    <Button size="sm" variant="ghost" className="min-h-10" onClick={() => void handleDelete(product)}>Sil</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {data && (cursors.length > 1 || !data.isDone) && <nav aria-label="Ürün sayfaları" className="flex items-center justify-between gap-3 border-t border-border p-4">
          <Button variant="outline" disabled={pending || cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">Sayfa {cursors.length}</span>
          <Button variant="outline" disabled={pending || data.isDone} onClick={() => setCursors((current) => [...current, data.continueCursor])}>Sonraki</Button>
        </nav>}
      </Card>


    </>
  );
}

export default function AdminProductsPage() {
  return <AdminProductsContent />;
}
