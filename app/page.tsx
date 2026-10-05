import { Carousel } from "@/components/carousel";
import { ThreeItemGrid } from "@/components/grid/three-items";
import Footer from "@/components/layout/footer";
import { baseUrl } from "@/lib/utils";

export const prefetch = "partial";

const SITE_NAME = process.env.SITE_NAME || "Commerce";

export const metadata = {
  title: `${SITE_NAME} | Resmi Online Mağaza`,
  description:
    "Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler. Hızlı teslimat ve güvenli ödeme.",
  openGraph: {
    type: "website",
    title: `${SITE_NAME} | Resmi Online Mağaza`,
    description:
      "Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler. Hızlı teslimat ve güvenli ödeme.",
    url: baseUrl,
  },
  alternates: {
    canonical: baseUrl,
  },
};

export default function HomePage() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
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
    name: SITE_NAME,
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
