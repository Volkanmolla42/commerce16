"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { ExportMenu } from "../_components/export-button";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import { type Category } from "./_components/product-editor-helpers";

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: string;
  categorySlug?: string;
  availableForSale: boolean;
  images: string[];
  favoriteCount?: number;
};

type ProductPage = {
  items: Product[];
  continueCursor: string;
  isDone: boolean;
};

const LIST_COLUMNS = "lg:grid-cols-[minmax(0,1.5fr)_140px_110px_90px_70px_130px]";

export default function AdminProductsPage() {
  const { data: categories } = useAdminResource<Category[]>("categories");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "active" | "inactive">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasActiveFilters = Boolean(query.trim()) || categoryFilter !== "all" || availabilityFilter !== "all";
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1] ?? "";

  const [requestParams, setRequestParams] = useState<Record<string, string>>({
    q: "",
    category: "all",
    availability: "all",
    cursor: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setRequestParams({
        q: query,
        category: categoryFilter,
        availability: availabilityFilter,
        cursor,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, categoryFilter, availabilityFilter, cursor]);

  const { data, error, loading, refresh } = useAdminResource<ProductPage>("products", requestParams);
  const filteredProducts = data?.items ?? [];
  const pending =
    loading ||
    requestParams.q !== query ||
    requestParams.category !== categoryFilter ||
    requestParams.availability !== availabilityFilter ||
    requestParams.cursor !== cursor;

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`“${product.title}” ürününü silmek istediğinize emin misiniz?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("product.delete", undefined, product._id);
      setMessage(`“${product.title}” silindi.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Ürün silinemedi.");
    }
  };

  return (
    <>
      <AdminHeaderAction route={adminPath("products")}>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 cursor-pointer">
            <Link href={adminPath("products/import")}>
              <ArrowUpTrayIcon className="size-4" />
              <span>İçe Aktar</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9 gap-1.5 cursor-pointer">
            <Link href={adminPath("products/add")}>
              <PlusIcon className="size-4" />
              <span>Yeni Ürün Ekle</span>
            </Link>
          </Button>
        </div>
      </AdminHeaderAction>

      {(message || actionError || error) && (
        <div className="mb-4">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        {/* Filtre ve Arama Barı */}
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_160px_140px_auto] sm:px-5 sm:items-center">
          <div className="relative min-w-0">
            <Label htmlFor="product-search" className="sr-only">
              Ürün ara
            </Label>
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="product-search"
              name="product-search"
              type="search"
              placeholder="Ürün adı veya bağlantı ara..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursors([null]);
              }}
              className="pl-9 h-10 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="category-select" className="sr-only">
              Kategori
            </Label>
            <select
              id="category-select"
              name="category-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCursors([null]);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              <option value="all">Tüm kategoriler</option>
              {categories?.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="availability-select" className="sr-only">
              Yayın Durumu
            </Label>
            <select
              id="availability-select"
              name="availability-select"
              value={availabilityFilter}
              onChange={(e) => {
                setAvailabilityFilter(e.target.value as typeof availabilityFilter);
                setCursors([null]);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              <option value="all">Tüm durumlar</option>
              <option value="active">Satışta</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 text-xs cursor-pointer"
                onClick={() => {
                  setQuery("");
                  setCategoryFilter("all");
                  setAvailabilityFilter("all");
                  setCursors([null]);
                }}
              >
                Filtreleri Temizle
              </Button>
            )}
            <ExportMenu type="products" />
          </div>
        </div>

        {/* Ürün Listesi */}
        {loading ? (
          <AdminLoading label="Ürünler" variant="table" />
        ) : filteredProducts.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={hasActiveFilters ? "Eşleşen ürün bulunamadı" : "Henüz ürün yok"}
              description={
                hasActiveFilters
                  ? "Arama veya filtre kriterlerini değiştirip deneyin."
                  : "İlk ürünü ekleyerek kataloğunuzu oluşturun."
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Masaüstü Başlık */}
            <div
              className={`hidden gap-4 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-5 lg:grid lg:items-center ${LIST_COLUMNS}`}
            >
              <span>Ürün</span>
              <span>Kategori</span>
              <span>Fiyat</span>
              <span>Durum</span>
              <span>Favori</span>
              <span className="text-right">İşlem</span>
            </div>

            {/* Satırlar */}
            {filteredProducts.map((product) => {
              const category = categories?.find((item) => item.slug === product.categorySlug);
              return (
                <article
                  key={product._id}
                  className={`grid gap-4 px-4 py-3.5 sm:px-5 lg:items-center ${LIST_COLUMNS} hover:bg-muted/30 transition-colors`}
                >
                  {/* Ürün Görsel & Başlık */}
                  <div className="flex min-w-0 items-center gap-3">
                    {product.images[0] ? (
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        <Image
                          src={product.images[0]}
                          alt={product.title}
                          fill
                          sizes="48px"
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <PhotoIcon className="size-5 opacity-40" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {product.title}
                        </h3>
                        <a
                          href={`/product/${product.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          title="Mağazada Gör"
                        >
                          <ArrowTopRightOnSquareIcon className="size-3.5" />
                        </a>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground truncate">
                        /{product.slug}
                      </p>
                    </div>
                  </div>

                  {/* Kategori */}
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground truncate">
                      {category?.title || "—"}
                    </span>
                  </div>

                  {/* Fiyat */}
                  <div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(product.price)}
                    </span>
                  </div>

                  {/* Durum Rozeti */}
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${
                        product.availableForSale
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {product.availableForSale ? "Satışta" : "Pasif"}
                    </Badge>
                  </div>

                  {/* Favori Sayısı */}
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {product.favoriteCount ?? 0}
                    </span>
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex items-center justify-end gap-1.5">
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs cursor-pointer">
                      <Link href={adminPath(`products/${product._id}/edit`)}>
                        <PencilSquareIcon className="size-3.5" />
                        <span>Düzenle</span>
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => void handleDelete(product)}
                      title="Sil"
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Sayfalama */}
        {data && (cursors.length > 1 || !data.isDone) && (
          <nav aria-label="Sayfalama" className="flex items-center justify-between border-t border-border p-4">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || cursors.length <= 1}
              onClick={() => setCursors((current) => current.slice(0, -1))}
              className="cursor-pointer"
            >
              Önceki Sayfa
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              Sayfa {cursors.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || data.isDone || !data.continueCursor}
              onClick={() => {
                if (data.continueCursor) {
                  setCursors((current) => [...current, data.continueCursor]);
                }
              }}
              className="cursor-pointer"
            >
              Sonraki Sayfa
            </Button>
          </nav>
        )}
      </Card>
    </>
  );
}
