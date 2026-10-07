import { Suspense } from "react";
import { getCategories } from "@/lib/catalog";
import FilterList from "./filter";

async function CategoryList() {
  const categories = await getCategories();
  return <FilterList list={categories} title="Kategoriler" />;
}

export default function Categories() {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="flex gap-2 overflow-hidden py-1">
          <div className="h-10 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  );
}
