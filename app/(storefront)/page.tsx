import { CategoryShortcuts, HomeProductShelf } from "@/components/home/home-sections";
import Footer from "@/components/layout/footer";
import { baseUrl } from "@/lib/utils";
import { getCategories, getRecommendationCatalog, getStoreSettings } from "@/lib/catalog";
import { PersonalizedRecommendationShelf } from "@/components/product/recommendation-shelves";
import type { Metadata } from "next";

export const prefetch = "partial";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, slogan } = await getStoreSettings();
  const title = `${storeName} | Resmi Online Mağaza`;
  const description = slogan.trim() || `${storeName} ürünlerini ve koleksiyonlarını keşfedin.`;

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
  const [{ storeName, logoUrl }, products, categories] = await Promise.all([
    getStoreSettings(),
    getRecommendationCatalog(),
    getCategories(),
  ]);
  const availableProducts = products.filter((product) => product.availableForSale);
  const organizationLogo = new URL(logoUrl || "/favicon.ico", baseUrl).toString();
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
    logo: organizationLogo,
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
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4">
        <CategoryShortcuts categories={categories} />
        <HomeProductShelf title="Öne çıkan ürünler" products={availableProducts.slice(0, 10)} />
        <PersonalizedRecommendationShelf products={products} />
      </div>
      <Footer />
    </>
  );
}
