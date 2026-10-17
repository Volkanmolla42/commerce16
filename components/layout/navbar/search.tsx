"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getRecentSearches, recordRecentSearch } from "@/lib/catalog/search-history";
import {
  ArrowRightIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { formatMoney } from "@/lib/format-money";
import { normalizeSearchText } from "@/lib/catalog/smart-search";
import { createUrl } from "@/lib/utils";

type SearchOption = {
  key: string;
  kind: "category" | "product" | "query";
  title: string;
  href: string;
  image?: string | null;
  price?: string;
  maxPrice?: string;
};

const headerInputClassName =
  "min-h-10 w-full rounded-full border border-neutral-200 bg-neutral-100/80 py-2 pl-9 pr-3 text-sm text-black transition placeholder:text-neutral-500 focus:border-neutral-400 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-neutral-600 dark:focus:bg-neutral-900";

const SEARCH_PLACEHOLDER = "Ürün veya kategori ara...";

export default function Search() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const componentId = useId();
  const listboxId = `search-suggestions-${componentId}`;
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedQuery = normalizeSearchText(query);
  const normalizedDebouncedQuery = normalizeSearchText(debouncedQuery);
  const shouldLoadSuggestions = isOpen && normalizedDebouncedQuery.length >= 2;
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [suggestionError, setSuggestionError] = useState(false);
  const [completedQuery, setCompletedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const recordSearchQuery = useMutation(api.search.record);
  const popularSearches = useQuery(
    api.search.popular,
    isOpen && normalizedQuery.length === 0 ? { limit: 5 } : "skip",
  );

  useEffect(() => {
    if (!shouldLoadSuggestions) return;
    const controller = new AbortController();
    fetch(`/api/catalog/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Arama yüklenemedi");
        const result: SearchOption[] = await response.json();
        if (!controller.signal.aborted) {
          setOptions(result);
          setSuggestionError(false);
          setCompletedQuery(debouncedQuery);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOptions([]);
          setSuggestionError(true);
          setCompletedQuery(debouncedQuery);
        }
      });
    return () => controller.abort();
  }, [shouldLoadSuggestions, debouncedQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  const isQuerySettled =
    normalizedQuery === normalizedDebouncedQuery &&
    normalizeSearchText(completedQuery) === normalizedDebouncedQuery;
  const isDiscovery = isOpen && normalizedQuery.length === 0;
  const recentOptions: SearchOption[] = isDiscovery
    ? recentSearches.map((term) => ({
        key: `recent:${term}`,
        kind: "query",
        title: term,
        href: `/search?q=${encodeURIComponent(term)}`,
      }))
    : [];
  const popularOptions: SearchOption[] = isDiscovery
    ? (popularSearches ?? [])
        .slice(0, Math.max(0, 8 - recentOptions.length))
        .map(({ query: term }) => ({
          key: `popular:${term}`,
          kind: "query",
          title: term,
          href: `/search?q=${encodeURIComponent(term)}`,
        }))
    : [];
  const discoveryOptions = [...recentOptions, ...popularOptions];
  const discoveryLoading = isDiscovery && popularSearches === undefined;
  const visibleOptions = isDiscovery ? discoveryOptions : isQuerySettled ? options : [];
  const panelIsVisible = isDiscovery || (isOpen && normalizedQuery.length >= 2);

  const rememberSearch = (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    recordRecentSearch(trimmed);
    setRecentSearches(getRecentSearches());
    void recordSearchQuery({ query: trimmed }).catch(() => undefined);
  };

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
      setActiveIndex((current) =>
        current <= 0 ? visibleOptions.length - 1 : current - 1,
      );
    } else if (event.key === "Home" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0 && visibleOptions[activeIndex]) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option.kind === "query") {
        setQuery(option.title);
        rememberSearch(option.title);
      }
      setIsOpen(false);
      router.push(option.href);
    }
  };

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) rememberSearch(trimmed);
    setIsOpen(false);
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    router.push(createUrl("/search", params));
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
        onClick={() => {
          if (option.kind === "query") {
            setQuery(option.title);
            rememberSearch(option.title);
          }
          setIsOpen(false);
        }}
        className={`flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-500 ${isActive
          ? "bg-neutral-100 dark:bg-neutral-800"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
      >
        {option.kind === "query" ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : option.kind === "category" ? (
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
            {option.kind === "query"
              ? "Arama"
              : option.kind === "category"
                ? "Kategori"
                : `${formatMoney(option.price ?? "0")}${option.maxPrice && Number(option.maxPrice) !== Number(option.price)
                  ? ` ile ${formatMoney(option.maxPrice)}`
                  : ""
                }`}
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
    <div ref={rootRef} className="relative w-full">
      {/* Arama odaktayken sayfayı bulanıklaştıran katman; header stack bağlamı (z-40) üstünde kaldığı için keskin kalır. */}
      {panelIsVisible
        ? createPortal(
          <div
            aria-hidden="true"
            className="fixed inset-0 z-30 animate-fade-in-slow bg-black/10 backdrop-blur-xs md:hidden dark:bg-black/20"
          />,
          document.body,
        )
        : null}

      <form action="/search" method="get" className="relative w-full" onSubmit={handleSubmit}>
        <label htmlFor={`${componentId}-input`} className="sr-only">
          Ürün veya kategori ara
        </label>

        <button
          type="submit"
          aria-label="Arama yap"
          className="absolute inset-y-0 left-0 z-10 flex cursor-pointer items-center pl-3 text-neutral-400 transition-colors duration-500"
        >
          <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
        </button>

        <input
          id={`${componentId}-input`}
          type="search"
          name="q"
          role="combobox"
          aria-label="Ürün veya kategori ara"
          aria-autocomplete="list"
          aria-expanded={panelIsVisible}
          aria-controls={panelIsVisible ? listboxId : undefined}
          aria-activedescendant={
            panelIsVisible && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          placeholder={SEARCH_PLACEHOLDER}
          autoComplete="off"
          value={query}
          onFocus={() => {
            setRecentSearches(getRecentSearches());
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={headerInputClassName}
        />
      </form>

      {panelIsVisible ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={isDiscovery ? "Son ve popüler aramalar" : "Arama önerileri"}
          className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[min(65vh,26rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 text-black shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
        >
          {isDiscovery ? (
            <>
              {recentOptions.length > 0 ? (
                <div role="group" aria-label="Son aramalarınız" className="pb-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Son aramalarınız
                  </p>
                  {recentOptions.map((option, index) => renderOption(option, index))}
                </div>
              ) : null}
              {discoveryLoading ? (
                <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Popüler aramalar yükleniyor...
                </p>
              ) : popularOptions.length > 0 ? (
                <div
                  role="group"
                  aria-label="Popüler aramalar"
                  className={recentOptions.length > 0 ? "border-t border-neutral-100 pt-1 dark:border-neutral-800" : ""}
                >
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Popüler aramalar
                  </p>
                  {popularOptions.map((option, index) => renderOption(option, recentOptions.length + index))}
                </div>
              ) : recentOptions.length === 0 ? (
                <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Henüz popüler arama yok.
                </p>
              ) : null}
            </>
          ) : !isQuerySettled ? (
            <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
              Öneriler hazırlanıyor...
            </p>
          ) : visibleOptions.length === 0 ? (
            <p role="status" className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
              {suggestionError
                ? "Arama önerileri yüklenemedi. Tüm sonuçları açabilirsiniz."
                : "Bu aramayla eşleşen ürün veya kategori bulunamadı."}
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
                <div
                  role="group"
                  aria-label="Ürünler"
                  className="border-t border-neutral-100 pt-1 dark:border-neutral-800"
                >
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Ürünler
                  </p>
                  {productOptions.map(({ option, index }) => renderOption(option, index))}
                </div>
              ) : null}
            </>
          )}
          {!isDiscovery ? (
            <Link
              href={{ pathname: "/search", query: { q: query.trim() } }}
              onClick={() => {
                const term = query.trim();
                if (term) rememberSearch(term);
                setIsOpen(false);
              }}
              className="mt-1 flex items-center justify-between border-t border-neutral-100 px-3 py-2.5 text-sm font-medium text-neutral-700 hover:text-black dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white"
            >
              <span>&quot;{query.trim()}&quot; için tüm sonuçları gör</span>
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
        <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
      </span>
      <input
        aria-label={SEARCH_PLACEHOLDER}
        placeholder={SEARCH_PLACEHOLDER}
        disabled
        className={headerInputClassName}
      />
    </div>
  );
}
