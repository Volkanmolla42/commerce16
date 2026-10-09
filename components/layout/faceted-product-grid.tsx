"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input } from "@/components/ui";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { defaultSort, sorting } from "@/lib/constants";
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

function CategoryAttributeFacet({
  definition,
  values,
  filter,
  onChange,
}: {
  definition: CategoryAttributeDefinition;
  values: string[];
  filter: CategoryAttributeFilter;
  onChange: (patch: Partial<CategoryAttributeFilter>) => void;
}) {
  const [optionSearch, setOptionSearch] = useState("");
  const visibleValues = values.filter((value) => value.toLocaleLowerCase("tr-TR").includes(optionSearch.toLocaleLowerCase("tr-TR"))).slice(0, 50);
  if (values.length === 0 && definition.type !== "number") return null;
  const numericValues = definition.type === "number"
    ? values.map(Number).filter(Number.isFinite)
    : [];

  return (
    <details className="group border-b border-border py-3 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{definition.label}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {filter.values.length + Number(filter.min !== "") + Number(filter.max !== "") || null}
          <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {definition.type === "number" ? (
        <fieldset className="mt-2 grid grid-cols-2 gap-2">
          <legend className="sr-only">{definition.label} aralığı</legend>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En az{definition.unit ? ` (${definition.unit})` : ""}</span>
            <Input type="number" inputMode="decimal" aria-label={`${definition.label} en az`} placeholder={numericValues.length ? String(Math.min(...numericValues)) : undefined} value={filter.min} onChange={(event) => onChange({ min: event.target.value })} className="min-h-11" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En çok{definition.unit ? ` (${definition.unit})` : ""}</span>
            <Input type="number" inputMode="decimal" aria-label={`${definition.label} en çok`} placeholder={numericValues.length ? String(Math.max(...numericValues)) : undefined} value={filter.max} onChange={(event) => onChange({ max: event.target.value })} className="min-h-11" />
          </label>
        </fieldset>
      ) : (
        <fieldset className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          <legend className="sr-only">{definition.label}</legend>
          {values.length > 50 ? <Input type="search" aria-label={`${definition.label} seçeneklerinde ara`} placeholder="Seçenek ara" value={optionSearch} onChange={(event) => setOptionSearch(event.target.value)} /> : null}
          {visibleValues.map((value) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-foreground hover:bg-muted">
              <input type="checkbox" checked={filter.values.includes(value)} onChange={() => onChange({
                values: filter.values.includes(value) ? filter.values.filter((item) => item !== value) : [...filter.values, value],
              })} className="size-4 shrink-0 accent-blue-500" />
              <span className="min-w-0 flex-1 break-words">{value === "true" ? "Evet" : value === "false" ? "Hayır" : value}</span>
            </label>
          ))}
        </fieldset>
      )}
    </details>
  );
}

function FacetControls({
  facetOptions,
  categoryAttributes,
  categoryAttributeFilters,
  onCategoryAttributeChange,
  filters,
  inputSuffix,
  onPriceChange,
}: {
  facetOptions: CatalogFacetOptions;
  categoryAttributes: CategoryAttributeDefinition[];
  categoryAttributeFilters: CategoryAttributeFilters;
  onCategoryAttributeChange: (key: string, patch: Partial<CategoryAttributeFilter>) => void;
  filters: CatalogFilters;
  inputSuffix: string;
  onPriceChange: (key: "minPrice" | "maxPrice", value: string) => void;
}) {
  return (
    <div>
      <fieldset className="space-y-2 border-b border-border py-3">
        <legend className="pb-2 text-sm font-semibold text-foreground">Fiyat aralığı</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En az (₺)</span>
            <Input
              aria-label="En düşük fiyat"
              className="min-h-12"
              inputMode="decimal"
              min="0"
              name={`min-price-${inputSuffix}`}
              onChange={(event) => onPriceChange("minPrice", event.target.value)}
              step="0.01"
              type="number"
              value={filters.minPrice}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En çok (₺)</span>
            <Input
              aria-label="En yüksek fiyat"
              className="min-h-12"
              inputMode="decimal"
              min="0"
              name={`max-price-${inputSuffix}`}
              onChange={(event) => onPriceChange("maxPrice", event.target.value)}
              step="0.01"
              type="number"
              value={filters.maxPrice}
            />
          </label>
        </div>
      </fieldset>

      {categoryAttributes.filter((definition) => definition.type !== "text").map((definition) => (
        <CategoryAttributeFacet
          key={definition.key}
          definition={definition}
          values={facetOptions.attributes[definition.key] ?? []}
          filter={categoryAttributeFilters[definition.key] ?? { values: [], min: "", max: "" }}
          onChange={(patch) => onCategoryAttributeChange(definition.key, patch)}
        />
      ))}

    </div>
  );
}

function SortMenu() {
  const pathname = usePathname() ?? "/search";
  const searchParams = useSearchParams();
  const isSearch = Boolean(searchParams.get("q")?.trim());
  const selectedSlug = isSearch ? null : searchParams.get("sort");
  const selectedSort = sorting.find((item) => item.slug === selectedSlug) ?? defaultSort;

  if (isSearch) return <span className="px-4 py-2.5 text-sm text-muted-foreground">Alaka sırası</span>;

  return (
    <details className="group relative">
      <summary
        aria-label={`Sıralama: ${selectedSort.title}`}
        className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-full border border-border bg-card px-4 text-sm text-foreground transition hover:border-blue-500/50 [&::-webkit-details-marker]:hidden"
      >
        <span className="text-muted-foreground">Sırala</span>
        <span className="font-medium">{selectedSort.title}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="absolute right-0 top-full z-30 mt-2 min-w-60 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
        {sorting.map((item) => {
          const params = new URLSearchParams(searchParams.toString());
          if (item.slug) params.set("sort", item.slug);
          else params.delete("sort");
          params.delete("page");
          params.delete("cursor");
          const active = item.slug === selectedSlug;

          return (
            <li key={item.slug ?? "recommended"}>
              <Link
                href={createUrl(pathname, params)}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors ${active
                    ? "bg-blue-500/10 font-medium text-blue-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function CategorySelect({
  categories,
  selectedCategory,
  query,
}: {
  categories: Category[];
  selectedCategory?: string;
  query?: string;
}) {
  const searchParams = useSearchParams();
  const selected = categories.find((category) => category.slug === selectedCategory)
    ?? categories.find((category) => category.slug === "");
  const categorySearchParams = new URLSearchParams();
  const currentQuery = searchParams.get("q") || query;
  const sort = searchParams.get("sort");
  if (currentQuery) categorySearchParams.set("q", currentQuery);
  if (sort) categorySearchParams.set("sort", sort);

  return (
    <details className="group relative">
      <summary
        aria-label={`Kategori: ${selected?.title ?? "Tümü"}`}
        className="flex min-h-12 max-w-full cursor-pointer list-none items-center gap-3 rounded-full border border-border bg-card px-4 text-sm text-foreground transition hover:border-blue-500/50 [&::-webkit-details-marker]:hidden"
      >
        <span className="text-muted-foreground">Kategori</span>
        <span className="max-w-28 truncate font-medium sm:max-w-44">{selected?.title ?? "Tümü"}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="absolute right-0 top-full z-40 mt-2 max-h-[min(60dvh,24rem)] min-w-56 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
        {categories.map((category) => (
          <li key={category.slug || "all"}>
            <Link
              href={createUrl(category.path, categorySearchParams)}
              prefetch={false}
              aria-current={category.slug === (selectedCategory ?? "") ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors ${category.slug === (selectedCategory ?? "")
                  ? "bg-blue-500/10 font-medium text-blue-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              {category.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
  const pathname = usePathname() ?? "/search";
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
      lastSubmitted.current = stateKey;
      const params = new URLSearchParams(searchKey);
      params.delete("page");
      params.delete("cursor");
      if (getActiveCatalogFilterCount(filters)) params.set("filters", JSON.stringify(filters));
      else params.delete("filters");
      if (getActiveCategoryAttributeFilterCount(categoryAttributeFilters)) params.set("attributes", JSON.stringify(categoryAttributeFilters));
      else params.delete("attributes");
      startTransition(() => router.replace(createUrl(pathname, params), { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [stateKey, searchKey, filters, categoryAttributeFilters, pathname, router]);
  const activeFilterCount = getActiveCatalogFilterCount(filters) + getActiveCategoryAttributeFilterCount(categoryAttributeFilters);

  const updatePrice = (key: "minPrice" | "maxPrice", value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
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
  };

  const pageTitle = title ?? (query ? `“${query}” sonuçları` : "Tüm ürünler");
  const showFilters = activeFilterCount > 0;

  return (
    <div className="min-w-0">
      <header className="mb-6 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {pageTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {query ? "Aramanızla eşleşen ürünler, alaka sırasına göre listelenir." : "Koleksiyondaki ürünleri inceleyin ve filtreleyin."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {categories?.length ? (
            <CategorySelect
              categories={categories}
              selectedCategory={selectedCategory}
              query={query}
            />
          ) : null}
          <p aria-live="polite" aria-atomic="true" className="rounded-full border border-border bg-card/70 px-4 py-2.5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {products.length}
            </span>{" "}
            ürün bu sayfada
          </p>
          <SortMenu />
        </div>
      </header>

      <div className={`grid min-w-0 gap-4 xl:gap-6 ${showFilters ? "xl:grid-cols-[250px_minmax(0,1fr)]" : ""}`}>
        {showFilters ? <details className="group overflow-hidden rounded-2xl border border-border bg-card xl:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span>Filtreler</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {activeFilterCount > 0 ? `${activeFilterCount} seçili` : null}
              <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-border px-4">
            <FacetControls {...panelProps} inputSuffix="mobile" />
          </div>
        </details> : null}

        {showFilters ? <aside className="hidden min-w-0 xl:block">
          <Card className="sticky top-24 rounded-2xl bg-card/60 p-5 shadow-none">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Filtreler</h2>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                  {activeFilterCount}
                </span>
              ) : null}
            </div>
            <FacetControls {...panelProps} inputSuffix="desktop" />
          </Card>
        </aside> : null}

        <section className={`min-w-0 ${isFiltering ? "opacity-60" : ""}`} aria-label="Filtrelenebilir ürünler" aria-busy={isFiltering}>
          {activeFilterCount > 0 ? (
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 text-blue-400"
                onClick={() => { setFilters(EMPTY_CATALOG_FILTERS); setCategoryAttributeFilters({}); }}
              >
                Filtreleri temizle
              </Button>
            </div>
          ) : null}

          {products.length > 0 ? (
            <Grid className="grid-cols-2 lg:grid-cols-3">
              <ProductGridItems products={products} cardLayout="stacked" />
            </Grid>
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
                  onClick={() => { setFilters(EMPTY_CATALOG_FILTERS); setCategoryAttributeFilters({}); }}
                >
                  Filtreleri temizle
                </Button>
              ) : query && products.length === 0 ? (
                <Button asChild variant="outline" className="mt-6 min-h-12 rounded-full px-5">
                  <Link href="/search">Tüm ürünleri göster</Link>
                </Button>
              ) : null}
            </Card>
          )}
          <CatalogPagination key={JSON.stringify([selectedCategory, query, initialFilters, initialAttributeFilters, searchParams.get("sort")])} continueCursor={continueCursor} isDone={isDone} count={products.length} />
        </section>
      </div>
    </div>
  );
}
