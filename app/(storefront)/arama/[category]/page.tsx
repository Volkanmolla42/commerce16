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
import { SearchSkeleton } from "../loading";

export const prefetch = "partial";

export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  const category = await getCategory(params.category);

  if (!category) return notFound();

  const parentMetadata = await parent;
  const title = category.title;
  const description = category.description || `${category.title} koleksiyonu ve ürünleri`;
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
    getCategory(params.category),
    getCategories(),
  ]);

  if (!category) return notFound();
  const catalog = await getCatalogPage(searchParams ?? {}, params.category);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Ana Sayfa",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category.title,
        item: new URL(category.path, baseUrl).toString(),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
        emptyMessage="Bu kategoride henüz ürün bulunmuyor."
      />
    </>
  );
}

export default function CategoryPage(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <CategoryContent
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}
