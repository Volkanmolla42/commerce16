import { routes } from "@/lib/storefront-routes";
import { FacetedProductGrid } from "@/components/layout/faceted-product-grid";
import { getCategories } from "@/lib/catalog";
import { getCatalogPage } from "@/lib/catalog/pages";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { SearchSkeleton } from "./loading";

export const prefetch = "partial";

export const metadata = pageMetadata({
  title: "Arama",
  description: "Mağazadaki tüm ürünleri ve koleksiyonları keşfedin.",
  path: routes.search,
  robots: { index: false, follow: true },
});

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
    <div className="space-y-4">
      <Suspense fallback={<SearchHeadingSkeleton />}>
        <SearchHeading searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchHeading(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";

  return (
    <h1 className="text-2xl font-semibold tracking-tight">
      {query ? `“${query}” sonuçları` : "Tüm ürünler"}
    </h1>
  );
}

function SearchHeadingSkeleton() {
  return <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded bg-muted" />;
}
