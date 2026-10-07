import { FacetedProductGrid } from "@/components/layout/faceted-product-grid";
import { defaultSort, sorting } from "@/lib/constants";
import { getProducts } from "@/lib/catalog";
import { Suspense } from "react";
import type { Metadata } from "next";

export const prefetch = "partial";

export const metadata: Metadata = {
  title: "Arama",
  description: "Mağazadaki ürünleri arayın.",
  robots: { index: false, follow: true },
};

async function SearchContent(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const sort = (searchParams?.sort as string) || undefined;
  const searchValue = (searchParams?.q as string) || undefined;
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const products = await getProducts({ sortKey, reverse, query: searchValue });

  return <FacetedProductGrid products={products} query={searchValue} />;
}

export default function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={null}>
      <SearchContent searchParams={props.searchParams} />
    </Suspense>
  );
}
