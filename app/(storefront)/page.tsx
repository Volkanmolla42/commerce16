import { Carousel } from "@/components/carousel";
import { ThreeItemGrid } from "@/components/grid/three-items";
import Footer from "@/components/layout/footer";
import { baseUrl } from "@/lib/utils";
import { getStoreSettings } from "@/lib/catalog";
import type { Metadata } from "next";

export const prefetch = "partial";

const homeDescription =
  "Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler. Hızlı teslimat ve güvenli ödeme.";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getStoreSettings();
  const title = storeName + " | Resmi Online Mağaza";

  return {
    title,
    description: homeDescription,
    openGraph: {
      type: "website",
      title,
      description: homeDescription,
      url: baseUrl,
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}

export default async function HomePage() {
  const { storeName } = await getStoreSettings();
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeName,
    url: baseUrl,
    logo: `${baseUrl}/favicon.ico`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <ThreeItemGrid />
      <Carousel />
      <Footer />
    </>
  );
}
