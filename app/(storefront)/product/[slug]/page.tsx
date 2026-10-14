import {
  productPageClassName,
  productGridClassName,
  productDetailsClassName,
} from "@/components/product/product-layout";
import { Gallery } from "@/components/product/gallery";
import {
  BoughtTogetherShelf,
  ProductViewTracker,
  Shelf,
} from "@/components/product/recommendation-shelves";
import { ProductDescription } from "@/components/product/product-description";
import {
  ProductSkeleton,
  ProductGallerySkeleton,
  ProductDescriptionSkeleton,
} from "@/components/product/product-skeleton";
import {
  getProduct,
  getProductRecommendations,
  getRecommendationCatalog,
} from "@/lib/catalog";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { baseUrl } from "@/lib/utils";
import { formatMoney } from "@/lib/format-money";

function getProductUrl(slug: string) {
  return new URL(`/product/${slug}`, baseUrl).toString();
}

function getAbsoluteHttpImageUrls(images: string[]) {
  return images.flatMap((image) => {
    try {
      const url = new URL(image, baseUrl);
      return url.protocol === "https:" || url.protocol === "http:"
        ? [url.toString()]
        : [];
    } catch {
      return [];
    }
  });
}

function getProductDescription(
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>,
) {
  return `${product.title} ürününü ${formatMoney(product.price)} fiyatıyla inceleyin.`;
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.slug);

  if (!product) return notFound();

  const parentMetadata = await parent;
  const title = product.title;
  const description = getProductDescription(product);
  const productUrl = getProductUrl(product.slug);
  const imageUrls = getAbsoluteHttpImageUrls(
    product.images.map(({ url }) => url),
  );

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      ...(parentMetadata.openGraph ?? {}),
      type: "website",
      title,
      description,
      url: productUrl,
      ...(imageUrls.length > 0
        ? { images: imageUrls.map((url) => ({ url, alt: product.title })) }
        : {}),
    },
    twitter: {
      ...(parentMetadata.twitter ?? {}),
      card: "summary_large_image",
      title,
      description,
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
    },
    alternates: {
      canonical: productUrl,
    },
  };
}

async function ProductContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return notFound();

  const productImageUrls = getAbsoluteHttpImageUrls(
    product.images.map(({ url }) => url),
  );
  const productUrl = getProductUrl(product.slug);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.title,
    description: getProductDescription(product),
    url: productUrl,
    ...(productImageUrls.length > 0 ? { image: productImageUrls } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      priceCurrency: "TRY",
      price: product.price,
    },
  };

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
      ...(product.categorySlug
        ? [
          {
            "@type": "ListItem",
            position: 2,
            name: product.categorySlug,
            item: new URL(
              `/search/${product.categorySlug}`,
              baseUrl,
            ).toString(),
          },
        ]
        : []),
      {
        "@type": "ListItem",
        position: product.categorySlug ? 3 : 2,
        name: product.title,
        item: productUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductViewTracker
        slug={product.slug}
        product={{ id: product.id, title: product.title, price: product.price }}
      />

      <div className={productPageClassName}>
        {/* Product Details Grid */}
        <div className={productGridClassName}>
          <div className="min-w-0">
            <Suspense fallback={<ProductGallerySkeleton />}>
              <Gallery key={product.id} product={product} />
            </Suspense>
          </div>

          <div className={productDetailsClassName}>
            <Suspense fallback={<ProductDescriptionSkeleton />}>
              <ProductDescription product={product} />
            </Suspense>
          </div>
        </div>

        {/* Product Recommendations & Upsells */}
        <Suspense fallback={null}>
          <ProductMerchandising product={product} />
        </Suspense>
      </div>
    </>
  );
}

async function ProductMerchandising({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>;
}) {
  const [relatedProducts, recommendationCatalog] = await Promise.all([
    getProductRecommendations(product),
    getRecommendationCatalog(),
  ]);

  return (
    <div className="border-t border-border/60 pt-10">
      <RelatedProducts products={relatedProducts} />
      <BoughtTogetherShelf
        products={recommendationCatalog}
        sourceProducts={[product]}
        sourceProductIds={[product.id]}
      />
    </div>
  );
}

export default function ProductPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={props.params} />
    </Suspense>
  );
}

function RelatedProducts({
  products,
}: {
  products: Awaited<ReturnType<typeof getProductRecommendations>>;
}) {
  if (!products.length) return null;

  return (
    <Shelf
      title="Benzer Ürünler"
      products={products}
      bordered={false}
      headerAction={
        <Link
          href="/search"
          className="shrink-0 text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
        >
          Daha Fazla Gör
        </Link>
      }
    />
  );
}
