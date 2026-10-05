import {
  getCategory,
  getCategoryProducts,
} from "@/lib/catalog";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { defaultSort, sorting } from "@/lib/constants";

export const prefetch = "partial";

export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const category = await getCategory(params.category);

  if (!category) return notFound();

  return {
    title: category.seo?.title || category.title,
    description:
      category.seo?.description ||
      category.description ||
      `${category.title} ürünleri`,
  };
}

async function CategoryContent(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const sort = (searchParams?.sort as string) || undefined;
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;
  const products = await getCategoryProducts({
    category: params.category,
    sortKey,
    reverse,
  });

  return (
    <section>
      {products.length === 0 ? (
        <p className="py-3 text-lg">Bu kategoride ürün bulunamadı</p>
      ) : (
        <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ProductGridItems products={products} />
        </Grid>
      )}
    </section>
  );
}

export default function CategoryPage(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={null}>
      <CategoryContent
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}
