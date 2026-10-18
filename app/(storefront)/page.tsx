import { CategoryShortcuts, HomeHero, HomeValueProps } from "@/components/home/home-sections";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import { baseUrl } from "@/lib/utils";
import { getCategories, getRecommendationCatalog, getStoreSettings } from "@/lib/catalog";
import { PersonalizedRecommendationShelf } from "@/components/product/recommendation-shelves";
import type { Metadata } from "next";

export const prefetch = "partial";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, slogan } = await getStoreSettings();
  const title = `${storeName} | Online Mağaza`;
  const description = slogan?.trim() || `${storeName} online mağazası.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: storeName,
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}

export default async function HomePage() {
  const [{ storeName, slogan, logoUrl, freeShippingThreshold }, products, categories] = await Promise.all([
    getStoreSettings(),
    getRecommendationCatalog(30),
    getCategories(),
  ]);

  const availableProducts = products.filter((product) => product.availableForSale);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: new URL("/", baseUrl).toString(),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${new URL("/search", baseUrl).toString()}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeName,
    url: new URL("/", baseUrl).toString(),
    ...(logoUrl ? { logo: new URL(logoUrl, baseUrl).toString() } : {}),
  };

  const featuredItemsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: availableProducts.slice(0, 10).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.title,
      url: new URL(`/product/${product.slug}`, baseUrl).toString(),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(featuredItemsJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-screen-2xl px-4">
        <HomeHero
          storeName={storeName}
          slogan={slogan}
          featuredProduct={availableProducts.find((product) => product.images.length > 0)}
          hasCategories={categories.some((category) => category.slug !== "")}
        />
        <CategoryShortcuts categories={categories} />
        {availableProducts.length > 0 ? (
          <section className="py-7 sm:py-9" aria-label="Öne Çıkan Ürünler">
            <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Öne Çıkan Ürünler
              </h2>
              <Link
                href="/search"
                className="shrink-0 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Tümünü Gör
              </Link>
            </div>
            <ProductGrid products={availableProducts.slice(0, 10)} />
          </section>
        ) : null}
        <PersonalizedRecommendationShelf products={products} />
        <HomeValueProps freeShippingThreshold={freeShippingThreshold} />
      </div>
    </>
  );
}
