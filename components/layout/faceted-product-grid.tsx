"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  getOptionKind,
  type CatalogFilters,
  type CategoryAttributeFilter,
  type CategoryAttributeFilters,
} from "@/lib/catalog/facets";

import type { CatalogFacetOptions } from "@/lib/catalog/paging";
import { CatalogPagination } from "./catalog-pagination";
import { createCatalogSearchParams } from "@/lib/catalog/search-params";

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

function OptionFacet({
  name,
  values,
  selectedValues,
  onChange,
}: {
  name: string;
  values: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  if (values.length === 0) return null;
  const kind = getOptionKind(name);

  const toggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <details open className="group border-b border-border py-3 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{name}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {selectedValues.length > 0 ? `${selectedValues.length} seçili` : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      {kind === "size" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() => toggle(val)}
                className={`h-10 min-w-11 rounded-xl border px-3 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs font-bold"
                    : "border-border/80 bg-muted/20 text-foreground hover:border-foreground/40 hover:bg-muted"
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      ) : kind === "color" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() => toggle(val)}
                className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/15 font-semibold text-primary ring-1 ring-primary/40 shadow-xs"
                    : "border-border/80 bg-muted/20 text-foreground hover:border-foreground/40 hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-current opacity-70" />
                <span>{val}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <fieldset className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          <legend className="sr-only">{name}</legend>
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <label key={val} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-foreground hover:bg-muted">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(val)}
                  className="size-4 shrink-0 accent-blue-500"
                />
                <span className="min-w-0 flex-1 break-words">{val}</span>
              </label>
            );
          })}
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
  onOptionChange,
}: {
  facetOptions: CatalogFacetOptions;
  categoryAttributes: CategoryAttributeDefinition[];
  categoryAttributeFilters: CategoryAttributeFilters;
  onCategoryAttributeChange: (key: string, patch: Partial<CategoryAttributeFilter>) => void;
  filters: CatalogFilters;
  inputSuffix: string;
  onPriceChange: (key: "minPrice" | "maxPrice", value: string) => void;
  onOptionChange: (name: string, values: string[]) => void;
}) {
  return (
    <div>
      <fieldset className="space-y-2 border-b border-border/60 py-3.5">
        <legend className="pb-1 text-sm font-semibold text-foreground">Fiyat aralığı</legend>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">En az (TL)</span>
            <Input
              aria-label="En düşük fiyat"
              placeholder="0"
              className="h-10 text-xs sm:text-sm rounded-xl border-border/80 bg-muted/20 focus:bg-background"
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
            <span className="text-xs font-medium text-muted-foreground">En çok (TL)</span>
            <Input
              aria-label="En yüksek fiyat"
              placeholder="9999"
              className="h-10 text-xs sm:text-sm rounded-xl border-border/80 bg-muted/20 focus:bg-background"
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

      {Object.entries(facetOptions.options ?? {}).map(([name, values]) => (
        <OptionFacet
          key={name}
          name={name}
          values={values}
          selectedValues={filters.options?.[name] ?? []}
          onChange={(newValues) => onOptionChange(name, newValues)}
        />
      ))}

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
                    <Link href="/search">Tüm ürünleri göster</Link>
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
