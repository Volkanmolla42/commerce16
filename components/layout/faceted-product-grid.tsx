"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input } from "@/components/ui";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { defaultSort, sorting } from "@/lib/constants";
import { createUrl } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";
import type { CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  EMPTY_CATALOG_FILTERS,
  getActiveCatalogFilterCount,
  getProductFacetOptions,
  getCategoryAttributeOptions,
  getProductAttributeValues,
  getActiveCategoryAttributeFilterCount,
  matchesCategoryAttributeFilters,
  isProductInStock,
  matchesCatalogFilters,
  type CatalogFilters,
  type CategoryAttributeFilter,
  type CategoryAttributeFilters,
  type ProductFacet,
} from "@/lib/catalog/facets";

const FACETS: { key: ProductFacet; title: string }[] = [
  { key: "size", title: "Beden" },
  { key: "color", title: "Renk" },
];

function FacetCheckboxGroup({
  facet,
  title,
  values,
  selected,
  onToggle,
}: {
  facet: ProductFacet;
  title: string;
  values: string[];
  selected: string[];
  onToggle: (facet: ProductFacet, value: string) => void;
}) {
  return (
    <details className="group border-b border-border py-3 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {selected.length > 0 ? selected.length : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <fieldset className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
        <legend className="sr-only">{title}</legend>
        {values.length ? (
          values.map((value) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-foreground hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(facet, value)}
                className="size-4 shrink-0 accent-blue-500"
              />
              <span className="min-w-0 flex-1 break-words">{value}</span>
            </label>
          ))
        ) : (
          <p className="py-2 text-xs text-muted-foreground">
            Bu alanda filtrelenebilir ürün bilgisi yok.
          </p>
        )}
      </fieldset>
    </details>
  );
}

function CategoryAttributeFacet({
  definition,
  products,
  filter,
  onChange,
}: {
  definition: CategoryAttributeDefinition;
  products: Product[];
  filter: CategoryAttributeFilter;
  onChange: (patch: Partial<CategoryAttributeFilter>) => void;
}) {
  const values = getCategoryAttributeOptions(products, definition);
  if (values.length === 0) return null;
  const numericValues = definition.type === "number"
    ? products.flatMap((product) => getProductAttributeValues(product, definition)).map(Number).filter(Number.isFinite)
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
          {values.map((value) => (
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
  products,
  categoryAttributes,
  categoryAttributeFilters,
  onCategoryAttributeChange,
  filters,
  inputSuffix,
  onPriceChange,
  onFacetToggle,
  onStockChange,
  onRatingChange,
}: {
  products: Product[];
  categoryAttributes: CategoryAttributeDefinition[];
  categoryAttributeFilters: CategoryAttributeFilters;
  onCategoryAttributeChange: (key: string, patch: Partial<CategoryAttributeFilter>) => void;
  filters: CatalogFilters;
  inputSuffix: string;
  onPriceChange: (key: "minPrice" | "maxPrice", value: string) => void;
  onFacetToggle: (facet: ProductFacet, value: string) => void;
  onStockChange: (value: CatalogFilters["stock"]) => void;
  onRatingChange: (value: number | null) => void;
}) {
  const facetOptions = useMemo(
    () => Object.fromEntries(FACETS.map(({ key }) => [key, getProductFacetOptions(products, key)])) as Record<ProductFacet, string[]>,
    [products],
  );
  const hasInStockProducts = products.some(isProductInStock);
  const hasOutOfStockProducts = products.some((product) => !isProductInStock(product));
  const ratingThresholds = [4, 3, 2, 1].filter((threshold) =>
    products.some((product) => (product.rating ?? 0) >= threshold),
  );

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

      {FACETS.map(({ key, title }) => (
        <FacetCheckboxGroup
          key={key}
          facet={key}
          title={title}
          values={facetOptions[key]}
          selected={filters[key]}
          onToggle={onFacetToggle}
        />
      ))}

      {categoryAttributes.filter((definition) => definition.type !== "text").map((definition) => (
        <CategoryAttributeFacet
          key={definition.key}
          definition={definition}
          products={products}
          filter={categoryAttributeFilters[definition.key] ?? { values: [], min: "", max: "" }}
          onChange={(patch) => onCategoryAttributeChange(definition.key, patch)}
        />
      ))}

      <details className="group border-b border-border py-3">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span>Stok durumu</span>
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </summary>
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">Stok durumu</legend>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted">
            <input
              type="radio"
              name={`stock-${inputSuffix}`}
              checked={filters.stock === ""}
              onChange={() => onStockChange("")}
              className="size-4 accent-blue-500"
            />
            Tümü
          </label>
          {hasInStockProducts ? (
            <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted">
              <input
                type="radio"
                name={`stock-${inputSuffix}`}
                checked={filters.stock === "in"}
                onChange={() => onStockChange("in")}
                className="size-4 accent-blue-500"
              />
              Stokta
            </label>
          ) : null}
          {hasOutOfStockProducts ? (
            <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted">
              <input
                type="radio"
                name={`stock-${inputSuffix}`}
                checked={filters.stock === "out"}
                onChange={() => onStockChange("out")}
                className="size-4 accent-blue-500"
              />
              Tükendi
            </label>
          ) : null}
          {!hasInStockProducts && !hasOutOfStockProducts ? (
            <p className="py-2 text-xs text-muted-foreground">Ürün bulunmuyor.</p>
          ) : null}
        </fieldset>
      </details>

      <details className="group py-3">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span>Puan</span>
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </summary>
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">En düşük puan</legend>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted">
            <input
              type="radio"
              name={`rating-${inputSuffix}`}
              checked={filters.rating === null}
              onChange={() => onRatingChange(null)}
              className="size-4 accent-blue-500"
            />
            Tüm puanlar
          </label>
          {ratingThresholds.map((threshold) => (
            <label
              key={threshold}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-muted"
            >
              <input
                type="radio"
                name={`rating-${inputSuffix}`}
                checked={filters.rating === threshold}
                onChange={() => onRatingChange(threshold)}
                className="size-4 accent-blue-500"
              />
              {threshold} puan ve üzeri
            </label>
          ))}
          {ratingThresholds.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              Henüz puanlanmış ürün yok.
            </p>
          ) : null}
        </fieldset>
      </details>
    </div>
  );
}

function SortMenu() {
  const pathname = usePathname() ?? "/search";
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get("sort");
  const selectedSort = sorting.find((item) => item.slug === selectedSlug) ?? defaultSort;

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

export function FacetedProductGrid({
  products,
  categoryAttributes = [],
  query,
  title,
  emptyMessage = "Ürün bulunamadı.",
}: {
  products: Product[];
  categoryAttributes?: CategoryAttributeDefinition[];
  query?: string;
  title?: string;
  emptyMessage?: string;
}) {
  const [filters, setFilters] = useState(EMPTY_CATALOG_FILTERS);
  const [categoryAttributeFilters, setCategoryAttributeFilters] = useState<CategoryAttributeFilters>({});
  const deferredFilters = useDeferredValue(filters);
  const deferredCategoryAttributeFilters = useDeferredValue(categoryAttributeFilters);
  const isFiltering = filters !== deferredFilters || categoryAttributeFilters !== deferredCategoryAttributeFilters;
  const filteredProducts = useMemo(
    () => products.filter((product) =>
      matchesCatalogFilters(product, deferredFilters) &&
      matchesCategoryAttributeFilters(product, categoryAttributes, deferredCategoryAttributeFilters),
    ),
    [categoryAttributes, deferredCategoryAttributeFilters, deferredFilters, products],
  );
  const activeFilterCount = getActiveCatalogFilterCount(filters) + getActiveCategoryAttributeFilterCount(categoryAttributeFilters);

  const updateFacet = (facet: ProductFacet, value: string) => {
    setFilters((current) => ({
      ...current,
      [facet]: current[facet].includes(value)
        ? current[facet].filter((selected) => selected !== value)
        : [...current[facet], value],
    }));
  };

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
    products,
    categoryAttributes,
    categoryAttributeFilters,
    onCategoryAttributeChange: updateCategoryAttribute,
    filters,
    onPriceChange: updatePrice,
    onFacetToggle: updateFacet,
    onStockChange: (stock: CatalogFilters["stock"]) =>
      setFilters((current) => ({ ...current, stock })),
    onRatingChange: (rating: number | null) =>
      setFilters((current) => ({ ...current, rating })),
  };

  const pageTitle = title ?? (query ? `“${query}” sonuçları` : "Tüm ürünler");

  return (
    <div className="min-w-0">
      <header className="mb-6 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {pageTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {query ? "Aramanızla eşleşen ve yakın bulunan ürünler." : "Koleksiyondaki ürünleri inceleyin ve filtreleyin."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <p aria-live="polite" aria-atomic="true" className="rounded-full border border-border bg-card/70 px-4 py-2.5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {activeFilterCount > 0 ? `${filteredProducts.length} / ${products.length}` : filteredProducts.length}
            </span>{" "}
            ürün
          </p>
          <SortMenu />
        </div>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6">
        <details className="group overflow-hidden rounded-2xl border border-border bg-card xl:hidden">
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
        </details>

        <aside className="hidden min-w-0 xl:block">
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
        </aside>

        <section className="min-w-0" aria-label="Filtrelenebilir ürünler" aria-busy={isFiltering}>
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

          {filteredProducts.length > 0 ? (
            <Grid className="grid-cols-2 lg:grid-cols-3">
              <ProductGridItems products={filteredProducts} cardLayout="stacked" />
            </Grid>
          ) : (
            <Card className="rounded-3xl border-dashed bg-card/40 px-6 py-12 text-center shadow-none sm:px-10 sm:py-16">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
                <MagnifyingGlassIcon aria-hidden="true" className="size-6" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                {products.length > 0 ? "Bu filtrelerle ürün bulunamadı" : query ? "Sonuç bulunamadı" : emptyMessage}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {products.length > 0
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
        </section>
      </div>
    </div>
  );
}
