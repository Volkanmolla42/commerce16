"use client";

import { routes } from "@/lib/storefront-routes";

import { ArrowsUpDownIcon, ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { defaultSort, sorting } from "@/lib/constants";
import type { Category } from "@/lib/catalog/types";
import { cn, createUrl } from "@/lib/utils";
import { DetailsDropdown } from "@/components/ui/dropdown";

type SelectionOption = { title: string; href: string; active: boolean };

function SelectionMenu({ label, value, inline, options, icon: Icon }: {
  label: string;
  value: string;
  inline: boolean;
  options: SelectionOption[];
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <DetailsDropdown className={inline ? "min-w-0" : "static min-w-0"}>
      <summary
        aria-label={`${label}: ${value}`}
        className={cn(
          "flex h-10 cursor-pointer list-none items-center justify-between gap-2 border border-border/80 bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition hover:border-foreground/30 hover:bg-muted [&::-webkit-details-marker]:hidden",
          inline ? "w-full rounded-xl" : "min-w-max rounded-full"
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="truncate font-medium">{value}</span>
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className={cn(
        "mt-2 max-h-[min(60dvh,24rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl",
        inline ? "absolute left-0 top-full z-40 w-full" : "absolute left-0 right-0 top-full z-40",
      )}>
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              prefetch={false}
              aria-current={option.active ? "page" : undefined}
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
              className={cn(
                "flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors",
                option.active ? "bg-blue-500/10 font-medium text-blue-700 dark:text-blue-400" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.title}
            </Link>
          </li>
        ))}
      </ul>
    </DetailsDropdown>
  );
}

export function SortMenu({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname() ?? routes.search;
  const searchParams = useSearchParams();
  const selectedSort = sorting.find((item) => item.slug === searchParams.get("sort")) ?? defaultSort;

  if (searchParams.get("q")?.trim()) {
    return (
      <span className={cn(
        "flex h-10 items-center gap-1.5 border border-border/80 bg-background px-3 text-xs font-semibold text-muted-foreground shadow-xs whitespace-nowrap",
        inline ? "w-full justify-between rounded-xl" : "min-w-max justify-center rounded-full"
      )}>
        <span className="flex items-center gap-1.5">
          <ArrowsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="whitespace-nowrap">Alaka sırası</span>
        </span>
      </span>
    );
  }

  const options = sorting.map((item) => {
    const params = new URLSearchParams(searchParams.toString());
    if (item.slug) params.set("sort", item.slug);
    else params.delete("sort");
    params.delete("page");
    params.delete("cursor");
    return { title: item.title, href: createUrl(pathname, params), active: item.slug === selectedSort.slug };
  });

  return <SelectionMenu label="Sıralama" value={selectedSort.title} inline={inline} options={options} icon={ArrowsUpDownIcon} />;
}

export function CategorySelect({ categories, selectedCategory = "", query, inline = false }: {
  categories: Category[];
  selectedCategory?: string;
  query?: string;
  inline?: boolean;
}) {
  const searchParams = useSearchParams();
  const selected = categories.find((category) => category.slug === selectedCategory);
  const params = new URLSearchParams();
  const currentQuery = searchParams.get("q") || query;
  const sort = searchParams.get("sort");
  if (currentQuery) params.set("q", currentQuery);
  if (sort) params.set("sort", sort);

  const options = categories.map((category) => ({
    title: category.title,
    href: createUrl(category.path, params),
    active: category.slug === selectedCategory,
  }));

  return <SelectionMenu label="Kategori" value={selected?.title ?? "Tüm Ürünler"} inline={inline} options={options} icon={Squares2X2Icon} />;
}
