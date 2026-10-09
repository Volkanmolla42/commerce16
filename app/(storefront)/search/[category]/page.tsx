import {
  getCategory,
  getCategories,
} from "@/lib/catalog";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { baseUrl } from "@/lib/utils";

import { FacetedProductGrid } from "@/components/layout/faceted-product-grid";
import { getCatalogPage } from "@/lib/catalog/pages";

export const prefetch = "partial";

export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  const category = await getCategory(params.category);

  if (!category) return notFound();

  const parentMetadata = await parent;
  const title = category.title;
  const description = category.description || `${category.title} ürünleri`;
  const canonical = new URL(category.path, baseUrl).toString();

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      ...(parentMetadata.openGraph ?? {}),
      type: "website",
      title,
      description,
      url: canonical,
    },
    twitter: {
      ...(parentMetadata.twitter ?? {}),
      card: "summary_large_image",
      title,
      description,
    },
  };
}

async function CategoryContent(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [category, categories] = await Promise.all([
    getCategory(params.category), getCategories(),
  ]);
  if (!category) return notFound();
  const catalog = await getCatalogPage(searchParams ?? {}, params.category);

  return (
    <FacetedProductGrid
      key={params.category}
      {...catalog}
      initialFilters={catalog.filters}
      initialAttributeFilters={catalog.attributeFilters}
      categories={categories}
      selectedCategory={params.category}
      query={typeof searchParams?.q === "string" ? searchParams.q : undefined}
      categoryAttributes={category.attributes}
      title={category.title}
      emptyMessage="Bu kategoride ürün bulunamadı."
    />
  );
}

export default function CategoryPage(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Ürünler yükleniyor…</p>}>
      <CategoryContent
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}
