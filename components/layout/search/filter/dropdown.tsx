"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { ListItem } from ".";
import { FilterItem } from "./item";

export default function FilterItemDropdown({ list }: { list: ListItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = list.find((item) =>
    "path" in item ? pathname === item.path : searchParams.get("sort") === item.slug,
  );

  return (
    <li>
      <details key={`${pathname}?${searchParams}`} className="group relative">
        <summary className="flex w-full cursor-pointer list-none items-center justify-between rounded-sm border border-black/30 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden dark:border-white/30">
          <span>{active?.title || list[0]?.title}</span>
          <ChevronDownIcon aria-hidden="true" className="h-4 group-open:rotate-180" />
        </summary>
        <ul className="absolute z-40 w-full rounded-b-md bg-white p-4 shadow-md dark:bg-black">
          {list.map((item) => <FilterItem key={item.title} item={item} />)}
        </ul>
      </details>
    </li>
  );
}
