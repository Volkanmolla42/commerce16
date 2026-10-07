"use client";

import clsx from "clsx";
import type { SortFilterItem } from "@/lib/constants";
import { createUrl } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ListItem, PathFilterItem } from ".";

function PathFilterItem({ item }: { item: PathFilterItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname === item.path;
  const newParams = new URLSearchParams(searchParams.toString());
  newParams.delete("q");

  const className = clsx(
    "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
    active
      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
      : "border-border bg-background/40 text-muted-foreground hover:border-blue-500/50 hover:bg-card hover:text-foreground",
  );

  return (
    <li className="flex shrink-0" key={item.title}>
      {active ? (
        <span aria-current="page" className={className}>{item.title}</span>
      ) : (
        <Link href={createUrl(item.path, newParams)} className={className}>
          {item.title}
        </Link>
      )}
    </li>
  );
}

function SortFilterItem({ item }: { item: SortFilterItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("sort") === item.slug;
  const q = searchParams.get("q");
  const href = createUrl(
    pathname,
    new URLSearchParams({
      ...(q && { q }),
      ...(item.slug && item.slug.length && { sort: item.slug }),
    }),
  );
  return (
    <li className="flex shrink-0 text-sm" key={item.title}>
      <Link
        prefetch={!active ? false : undefined}
        href={href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "inline-flex min-h-10 items-center rounded-full border px-4 font-medium transition-colors",
          active
            ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
            : "border-border bg-background/40 text-muted-foreground hover:border-blue-500/50 hover:bg-card hover:text-foreground",
        )}
      >
        {item.title}
      </Link>
    </li>
  );
}

export function FilterItem({ item }: { item: ListItem }) {
  return "path" in item ? (
    <PathFilterItem item={item} />
  ) : (
    <SortFilterItem item={item} />
  );
}
