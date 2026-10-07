import { SortFilterItem } from "@/lib/constants";
import { Suspense } from "react";
import { FilterItem } from "./item";

export type ListItem = SortFilterItem | PathFilterItem;
export type PathFilterItem = { title: string; path: string };

function FilterItemList({ list }: { list: ListItem[] }) {
  return (
    <>
      {list.map((item) => (
        <FilterItem key={"path" in item ? item.path : item.slug ?? item.title} item={item} />
      ))}
    </>
  );
}

export default function FilterList({
  list,
  title,
}: {
  list: ListItem[];
  title?: string;
}) {
  return (
    <nav aria-label={title ?? "Filtreler"} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      {title ? (
        <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <ul className="flex min-w-0 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        <Suspense fallback={null}>
          <FilterItemList list={list} />
        </Suspense>
      </ul>
    </nav>
  );
}
