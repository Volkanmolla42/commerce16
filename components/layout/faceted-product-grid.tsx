"use client";

import { routes } from "@/lib/storefront-routes";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductGrid } from "@/components/product/product-grid";
import { CategorySelect, SortMenu } from "./catalog-selection";
import { createUrl } from "@/lib/utils";
import type { Category, Product } from "@/lib/catalog/types";
import type { CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  EMPTY_CATALOG_FILTERS,
  getActiveCatalogFilterCount,
  getActiveCategoryAttributeFilterCount,
  type CatalogFilters,
  type CategoryAttributeFilter,
  type CategoryAttributeFilters,
} from "@/lib/catalog/facets";

import type { CatalogFacetOptions } from "@/lib/catalog/paging";
import { CatalogPagination } from "./catalog-pagination";
import { FacetControls } from "./catalog-facets";
import { createCatalogSearchParams } from "@/lib/catalog/search-params";

export function FacetedProductGrid({
  products,
  categories,
  selectedCategory,
  categoryAttributes = [],
  query,
  title,
  emptyMessage = "Ürün bulunamadı.",
  continueCursor, isDone, facets, initialFilters, initialAttributeFilters,
}: {
  products: Product[];
  categories?: Category[];
  selectedCategory?: string;
  categoryAttributes?: CategoryAttributeDefinition[];
  query?: string;
  title?: string;
  emptyMessage?: string;
  continueCursor: string; isDone: boolean; facets: CatalogFacetOptions;
  initialFilters: CatalogFilters; initialAttributeFilters: CategoryAttributeFilters;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [categoryAttributeFilters, setCategoryAttributeFilters] = useState(initialAttributeFilters);
  const [isFiltering, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname() ?? routes.search;
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const lastSubmitted = useRef(JSON.stringify([initialFilters, initialAttributeFilters]));
  const stateKey = JSON.stringify([filters, categoryAttributeFilters]);
  const initialKey = JSON.stringify([initialFilters, initialAttributeFilters]);
  const localKey = useRef(stateKey);
  useEffect(() => { localKey.current = stateKey; }, [stateKey]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localKey.current !== lastSubmitted.current) return;
      lastSubmitted.current = initialKey;
      const [nextFilters, nextAttributes] = JSON.parse(initialKey) as [CatalogFilters, CategoryAttributeFilters];
      setFilters(nextFilters);
      setCategoryAttributeFilters(nextAttributes);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialKey]);

  useEffect(() => {
    if (stateKey === lastSubmitted.current) return;
    const timer = setTimeout(() => {
      if (stateKey === lastSubmitted.current) return;
      lastSubmitted.current = stateKey;
      const params = createCatalogSearchParams(searchKey, filters, categoryAttributeFilters);
      startTransition(() => router.replace(createUrl(pathname, params), { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [stateKey, searchKey, filters, categoryAttributeFilters, pathname, router]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileFiltersOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [mobileFiltersOpen]);

  const clearAllFilters = () => {
    setFilters(EMPTY_CATALOG_FILTERS);
    setCategoryAttributeFilters({});
    lastSubmitted.current = JSON.stringify([EMPTY_CATALOG_FILTERS, {}]);
    const params = createCatalogSearchParams(searchKey, EMPTY_CATALOG_FILTERS, {});
    startTransition(() => {
      router.replace(createUrl(pathname, params), { scroll: false });
    });
  };

  const activeFilterCount = getActiveCatalogFilterCount(filters) + getActiveCategoryAttributeFilterCount(categoryAttributeFilters);

  const updatePrice = (key: "minPrice" | "maxPrice", value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const updateOption = (name: string, values: string[]) => {
    setFilters((current) => {
      const currentOptions = { ...(current.options ?? {}) };
      if (values.length > 0) {
        currentOptions[name] = values;
      } else {
        delete currentOptions[name];
      }
      return { ...current, options: currentOptions };
    });
  };

  const updateCategoryAttribute = (key: string, patch: Partial<CategoryAttributeFilter>) => {
    setCategoryAttributeFilters((current) => {
      const filter = current[key] ?? { values: [], min: "", max: "" };
      return { ...current, [key]: { ...filter, ...patch } };
    });
  };

  const panelProps = {
    facetOptions: facets,
    categoryAttributes,
    categoryAttributeFilters,
    onCategoryAttributeChange: updateCategoryAttribute,
    filters,
    onPriceChange: updatePrice,
    onOptionChange: updateOption,
  };

  const categoryTitle = categories?.find((category) => category.slug === selectedCategory)?.title;
  const pageTitle = title ?? categoryTitle ?? (query ? `“${query}” sonuçları` : "Tüm ürünler");

  return (
    <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
    <div className="min-w-0">
      <h1 className="sr-only">{pageTitle}</h1>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-w-0 xl:block">
          <Card className="sticky top-20 rounded-2xl bg-card/60 p-5 shadow-none space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FunnelIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">Filtreler</h2>
              </div>
              {activeFilterCount > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Temizle
                  </button>
                </div>
              ) : null}
            </div>

            {/* Masaüstü Sıralama ve Kategori */}
            <div className="space-y-3 border-b border-border pb-4">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sıralama
                </span>
                <SortMenu inline />
              </div>

              {categories?.length ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Kategori
                  </span>
                  <CategorySelect
                    categories={categories}
                    selectedCategory={selectedCategory}
                    query={query}
                    inline
                  />
                </div>
              ) : null}
            </div>

            <FacetControls {...panelProps} inputSuffix="desktop" />
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <div className="relative z-30 xl:hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <div className="shrink-0">
                <DialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Filtre panelini aç/kapat"
                    className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition hover:border-foreground/30 hover:bg-muted whitespace-nowrap"
                  >
                    <AdjustmentsHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>Filtreler</span>
                    {activeFilterCount > 0 ? (
                      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                </DialogTrigger>
              </div>

              {categories?.length ? (
                <div className="shrink-0">
                  <CategorySelect
                    categories={categories}
                    selectedCategory={selectedCategory}
                    query={query}
                  />
                </div>
              ) : null}

              <div className="shrink-0">
                <SortMenu />
              </div>
            </div>
          </div>

          <DialogContent
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              filterTitleRef.current?.focus();
            }}
            className="bottom-0 left-0 top-auto max-h-[85dvh] max-w-none grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 rounded-b-none rounded-t-[28px] border-t border-border/80 bg-background p-0 shadow-2xl translate-x-0 translate-y-0"
          >
            {/* Sürükleme / Tutma Çubuğu */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Başlık Satırı */}
            <div className="flex items-center justify-between border-b border-border/60 px-5 pb-3.5 pt-1 pr-12">
              <div className="flex items-center gap-2">
                <DialogTitle ref={filterTitleRef} tabIndex={-1} className="text-base font-semibold text-foreground">
                  Filtreler
                </DialogTitle>
                {activeFilterCount > 0 ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Kaydırılabilir Filtreler */}
            <div className="overflow-y-auto overscroll-contain px-5 py-2">
              <FacetControls {...panelProps} inputSuffix="mobile" />
            </div>

            {/* Dengeli ve Uyumlu Alt Eylem Butonları */}
            <div className="grid grid-cols-2 gap-3 border-t border-border/60 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
              <Button
                type="button"
                variant="outline"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
                className="h-12 rounded-xl text-xs font-semibold text-foreground border-border/80 hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                Temizle {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </Button>
              <DialogClose asChild>
                <Button className="h-12 rounded-xl text-xs font-semibold shadow-xs cursor-pointer">
                  Ürünleri Göster
                </Button>
              </DialogClose>
            </div>
          </DialogContent>

          <section
            className={`relative min-w-0 transition-opacity duration-200 ${isFiltering ? "opacity-50" : ""}`}
            aria-label="Filtrelenebilir ürünler"
            aria-busy={isFiltering}
          >
            {isFiltering ? (
              <div className="absolute inset-x-0 -top-3 z-10 flex justify-center">
                <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-md">
                  Güncelleniyor...
                </span>
              </div>
            ) : null}

            {products.length > 0 ? (
              <ProductGrid
                products={products}
                className="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
              />
            ) : (
              <Card className="rounded-3xl border-dashed bg-card/40 px-6 py-12 text-center shadow-none sm:px-10 sm:py-16">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
                  <MagnifyingGlassIcon aria-hidden="true" className="size-6" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">
                  {!isDone ? "Bu sayfada eşleşen ürün yok" : activeFilterCount > 0 ? "Bu filtrelerle ürün bulunamadı" : query ? "Sonuç bulunamadı" : emptyMessage}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {!isDone
                    ? "Sonraki sayfayı inceleyebilirsiniz."
                    : activeFilterCount > 0
                    ? "Daha fazla ürünü görmek için seçili filtreleri kaldırın."
                    : query
                      ? "Aramanızı kısaltıp farklı bir yazımla tekrar deneyin."
                      : "Yeni ürünler eklendiğinde burada görünecek."}
                </p>
                {activeFilterCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 min-h-12 rounded-full px-5"
                    onClick={clearAllFilters}
                  >
                    Filtreleri temizle
                  </Button>
                ) : query && products.length === 0 ? (
                  <Button asChild variant="outline" className="mt-6 min-h-12 rounded-full px-5">
                    <Link href={routes.search}>Tüm ürünleri göster</Link>
                  </Button>
                ) : null}
              </Card>
            )}
            <CatalogPagination key={JSON.stringify([selectedCategory, query, initialFilters, initialAttributeFilters, searchParams.get("sort")])} continueCursor={continueCursor} isDone={isDone} count={products.length} />
          </section>
        </div>
      </div>
    </div>
    </Dialog>
  );
}
