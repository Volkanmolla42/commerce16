import { routes } from "@/lib/storefront-routes";
import { CategoryShortcuts, HomeHero, HomeValueProps } from "@/components/home/home-sections";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import { storeOgImage, storeTwitterImage } from "@/lib/seo";
import { storeConfig } from "@/lib/store-config";
import { baseUrl } from "@/lib/utils";
import { getCategories, getRecommendationCatalog, getStoreSettings } from "@/lib/catalog";
import { PersonalizedRecommendationShelf } from "@/components/product/recommendation-shelves";
import type { Metadata } from "next";
import { Suspense } from "react";

export const prefetch = "partial";

const homeTitle = `${storeConfig.name} | ${storeConfig.slogan}`;

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: storeConfig.description,
  openGraph: {
    type: "website",
    title: homeTitle,
    description: storeConfig.description,
    siteName: storeConfig.name,
    url: baseUrl,
    images: [storeOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: storeConfig.description,
    images: [storeTwitterImage],
  },
  alternates: {
    canonical: baseUrl,
  },
};

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeStructuredData />
      </Suspense>
      <div className="mx-auto max-w-screen-2xl px-4">
        <Suspense fallback={<HomeHero storeName={storeConfig.name} slogan={storeConfig.slogan} hasCategories />}>
          <HomeHeroContent />
        </Suspense>
        <Suspense fallback={null}>
          <HomeCategoryShortcuts />
        </Suspense>
        <Suspense fallback={<HomeFeaturedProductsSkeleton />}>
          <HomeFeaturedProducts />
        </Suspense>
        <Suspense fallback={null}>
          <HomePersonalizedRecommendations />
        </Suspense>
        <Suspense fallback={<HomeValuePropsSkeleton />}>
          <HomeStoreValueProps />
        </Suspense>
      </div>
    </>
  );
}

async function HomeStructuredData() {
  const [{ phone, email }, products] = await Promise.all([
    getStoreSettings(),
    getRecommendationCatalog(30),
  ]);
  const availableProducts = products.filter((product) => product.availableForSale);
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeConfig.name,
    url: new URL("/", baseUrl).toString(),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${new URL(routes.search, baseUrl).toString()}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeConfig.name,
    url: new URL("/", baseUrl).toString(),
    logo: new URL(storeConfig.logo, baseUrl).toString(),
    description: storeConfig.description,
    ...(storeConfig.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: storeConfig.address,
            addressCountry: storeConfig.country,
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    ...(phone || email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            ...(phone ? { telephone: phone } : {}),
            ...(email ? { email } : {}),
            areaServed: storeConfig.country,
            availableLanguage: ["tr"],
          },
        }
      : {}),
  };

  const featuredItemsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: availableProducts.slice(0, 10).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.title,
      url: new URL(routes.product(product.slug), baseUrl).toString(),
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
    </>
  );
}

async function HomeHeroContent() {
  const [products, categories] = await Promise.all([
    getRecommendationCatalog(30),
    getCategories(),
  ]);
  const featuredProduct = products.find((product) => product.availableForSale && product.images.length > 0);
  return (
    <HomeHero
      storeName={storeConfig.name}
      slogan={storeConfig.slogan}
      featuredProduct={featuredProduct}
      hasCategories={categories.some((category) => category.slug !== "")}
    />
  );
}

async function HomeCategoryShortcuts() {
  return <CategoryShortcuts categories={await getCategories()} />;
}

async function HomeFeaturedProducts() {
  const products = (await getRecommendationCatalog(30))
    .filter((product) => product.availableForSale)
    .slice(0, 10);
  if (products.length === 0) return null;

  return (
    <section className="py-7 sm:py-9" aria-label="Öne Çıkan Ürünler">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Öne Çıkan Ürünler
        </h2>
        <Link
          href={routes.search}
          className="shrink-0 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Tümünü Gör
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}

async function HomePersonalizedRecommendations() {
  return <PersonalizedRecommendationShelf products={await getRecommendationCatalog(30)} />;
}

async function HomeStoreValueProps() {
  const { freeShippingThreshold } = await getStoreSettings();
  return <HomeValueProps freeShippingThreshold={freeShippingThreshold} />;
}

function HomeFeaturedProductsSkeleton() {
  return (
    <section className="py-7 sm:py-9" aria-hidden="true">
      <div className="mb-4 h-7 w-48 animate-pulse rounded bg-muted sm:mb-5" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card p-3">
            <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeValuePropsSkeleton() {
  return (
    <div className="my-10 grid grid-cols-1 gap-6 rounded-2xl border border-border/60 bg-muted/20 px-6 py-6 sm:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-12 animate-pulse rounded-xl bg-muted/60" />
      ))}
    </div>
  );
}
