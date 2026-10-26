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
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";
import { SearchSkeleton } from "../loading";

export const prefetch = "partial";

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    const params = categories.flatMap(({ slug }) => slug ? [{ category: slug }] : []);
    return params.length ? params : [{ category: PLACEHOLDER_HANDLE }];
  } catch {
    return [{ category: PLACEHOLDER_HANDLE }];
  }
}

export async function generateMetadata(props: {
  params: Promise<{ category: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  if (params.category === PLACEHOLDER_HANDLE) return {};
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
  const params = await props.params;
  if (params.category === PLACEHOLDER_HANDLE) return notFound();
  const searchParams = await props.searchParams;
  const [category, categories, catalog] = await Promise.all([
    getCategory(params.category),
    getCategories(),
    getCatalogPage(searchParams ?? {}, params.category),
  ]);

  if (!category) return notFound();

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
    <div className="space-y-4">
      <Suspense fallback={<CategoryHeadingSkeleton />}>
        <CategoryHeading params={props.params} />
      </Suspense>
      <Suspense fallback={<SearchSkeleton />}>
        <CategoryContent
          params={props.params}
          searchParams={props.searchParams}
        />
      </Suspense>
    </div>
  );
}

async function CategoryHeading({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = slug === PLACEHOLDER_HANDLE ? undefined : await getCategory(slug);
  if (!category) return null;

  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{category.title}</h1>
      {category.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
      ) : null}
    </header>
  );
}

function CategoryHeadingSkeleton() {
  return <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded bg-muted" />;
}
