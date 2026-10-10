import { FacetedProductGrid } from "@/components/layout/faceted-product-grid";
import { getCategories } from "@/lib/catalog";
import { getCatalogPage } from "@/lib/catalog/pages";
import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchSkeleton } from "./loading";

export const prefetch = "partial";

export const metadata: Metadata = {
  title: "Arama",
  description: "Mağazadaki tüm ürünleri ve koleksiyonları keşfedin.",
  robots: { index: false, follow: true },
};

async function SearchContent(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const searchValue = typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const [catalog, categories] = await Promise.all([
    getCatalogPage(searchParams ?? {}),
    getCategories(),
  ]);

  return (
    <FacetedProductGrid
      {...catalog}
      initialFilters={catalog.filters}
      initialAttributeFilters={catalog.attributeFilters}
      categories={categories}
      query={searchValue}
    />
  );
}

export default function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent searchParams={props.searchParams} />
    </Suspense>
  );
}
