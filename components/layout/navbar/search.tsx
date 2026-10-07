"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/lib/format-money";
import { getProductSearchFields, normalizeSearchText, rankSearchItems } from "@/lib/catalog/smart-search";
import { getProductPriceRange } from "@/lib/catalog/variants";

type SearchOption = {
  key: string;
  kind: "category" | "product";
  title: string;
  href: string;
  image?: string | null;
  price?: string;
  maxPrice?: string;
};

export default function Search() {
  const currentQuery = useSearchParams()?.get("q") ?? "";
  return <SearchInput key={currentQuery} initialQuery={currentQuery} />;
}

function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const componentId = useId();
  const listboxId = `search-suggestions-${componentId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = normalizeSearchText(query);
  const normalizedDebouncedQuery = normalizeSearchText(debouncedQuery);
  const shouldLoadSuggestions = isOpen && normalizedDebouncedQuery.length >= 2;
  const productsData = useQuery(api.products.list, shouldLoadSuggestions ? { limit: 100 } : "skip");
  const categoriesData = useQuery(api.categories.list, shouldLoadSuggestions ? {} : "skip");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 140);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  const options = useMemo<SearchOption[]>(() => {
    if (!productsData || !categoriesData || normalizedDebouncedQuery.length < 2) return [];

    const categoryMatches = rankSearchItems(
      categoriesData,
      debouncedQuery,
      (category) => [category.title, category.slug, category.description, category.seo?.title, category.seo?.description],
    ).slice(0, 3).map((category) => ({
      key: `category-${category.slug}`,
      kind: "category" as const,
      title: category.title,
      href: `/search/${encodeURIComponent(category.slug)}`,
    }));

    const productMatches = rankSearchItems(
      productsData,
      debouncedQuery,
      getProductSearchFields,
    ).slice(0, 5).map((product) => {
      const priceRange = getProductPriceRange(product);
      return {
        key: `product-${product.slug}`,
        kind: "product" as const,
        title: product.title,
        href: `/product/${encodeURIComponent(product.slug)}`,
        image: product.images[0] ?? null,
        price: priceRange.min,
        maxPrice: priceRange.max,
      };
    });

    return [...categoryMatches, ...productMatches];
  }, [productsData, categoriesData, debouncedQuery, normalizedDebouncedQuery]);

  const isQuerySettled = normalizedQuery === normalizedDebouncedQuery;
  const visibleOptions = isQuerySettled ? options : [];
  const panelIsVisible = isOpen && normalizedQuery.length >= 2;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? visibleOptions.length - 1 : current - 1);
    } else if (event.key === "Home" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0 && visibleOptions[activeIndex]) {
      event.preventDefault();
      setIsOpen(false);
      router.push(visibleOptions[activeIndex].href);
    }
  };

  const renderOption = (option: SearchOption, index: number) => {
    const isActive = index === activeIndex;
    return (
      <Link
        key={option.key}
        id={`${listboxId}-option-${index}`}
        href={option.href}
        role="option"
        aria-selected={isActive}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => setIsOpen(false)}
        className={`flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-500 ${
          isActive
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
      >
        {option.kind === "category" ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            <Squares2X2Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : option.image ? (
          <Image
            src={option.image}
            width={44}
            height={44}
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-neutral-700"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            <CubeIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-900 dark:text-white">
            {option.title}
          </span>
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            {option.kind === "category" ? "Kategori" : `${formatMoney(option.price ?? "0")}${option.maxPrice && Number(option.maxPrice) !== Number(option.price) ? ` ile ${formatMoney(option.maxPrice)}` : ""}`}
          </span>
        </span>
        {option.kind === "category" ? (
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        ) : null}
      </Link>
    );
  };

  const categoryOptions = visibleOptions
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.kind === "category");
  const productOptions = visibleOptions
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.kind === "product");

  return (
    <div ref={rootRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      <Form
        action="/search"
        onSubmit={() => setIsOpen(false)}
        className="relative w-full"
      >
        <label htmlFor={`${componentId}-input`} className="sr-only">
          Ürün veya kategori ara
        </label>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <input
          id={`${componentId}-input`}
          type="search"
          name="q"
          role="combobox"
          aria-label="Ürün veya kategori ara"
          aria-autocomplete="list"
          aria-expanded={panelIsVisible}
          aria-controls={panelIsVisible ? listboxId : undefined}
          aria-activedescendant={panelIsVisible && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          placeholder="Ürün veya kategori ara..."
          autoComplete="off"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-full border border-neutral-200 bg-neutral-100/80 py-2 pl-9 pr-4 text-sm text-black transition placeholder:text-neutral-500 focus:border-neutral-400 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
        />
      </Form>

      {panelIsVisible ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Arama önerileri"
          className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 text-black shadow-xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
        >
          {!isQuerySettled || productsData === undefined || categoriesData === undefined ? (
            <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
              Öneriler hazırlanıyor...
            </p>
          ) : visibleOptions.length === 0 ? (
            <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
              Bu aramayla eşleşen ürün veya kategori bulunamadı.
            </p>
          ) : (
            <>
              {categoryOptions.length > 0 ? (
                <div role="group" aria-label="Kategoriler" className="pb-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Kategoriler
                  </p>
                  {categoryOptions.map(({ option, index }) => renderOption(option, index))}
                </div>
              ) : null}
              {productOptions.length > 0 ? (
                <div role="group" aria-label="Ürünler" className="border-t border-neutral-100 pt-1 dark:border-neutral-800">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Ürünler
                  </p>
                  {productOptions.map(({ option, index }) => renderOption(option, index))}
                </div>
              ) : null}
            </>
          )}
          <Link
            href={{ pathname: "/search", query: { q: query.trim() } }}
            onClick={() => setIsOpen(false)}
            className="mt-1 flex items-center justify-between border-t border-neutral-100 px-3 py-2.5 text-sm font-medium text-neutral-700 hover:text-black dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white"
          >
            <span>&quot;{query.trim()}&quot; için tüm sonuçları gör</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
        <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
      </div>
      <input
        placeholder="Ürün veya kategori ara..."
        disabled
        className="w-full rounded-full border border-neutral-200 bg-neutral-100/80 py-2 pl-9 pr-4 text-sm text-black placeholder:text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white"
      />
    </div>
  );
}
