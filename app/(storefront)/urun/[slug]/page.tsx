import { routes } from "@/lib/storefront-routes";
import {
  productPageClassName,
  productGridClassName,
  productDetailsClassName,
  productGalleryClassName,
} from "@/components/product/product-layout";
import { Gallery } from "@/components/product/gallery";
import {
  BoughtTogetherShelf,
  ProductViewTracker,
  Shelf,
} from "@/components/product/recommendation-shelves";
import { RecentlyViewedShelf } from "@/components/product/recently-viewed-shelf";
import { ProductInfoTabs } from "@/components/product/product-info-tabs";
import { ProductDescription } from "@/components/product/product-description";
import { getDefaultVariant } from "@/lib/catalog/variants";
import { ProductReviews } from "@/components/product/product-reviews";
import {
  ProductSkeleton,
  ProductGallerySkeleton,
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
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import Image from "next/image";

export async function generateStaticParams() {
  try {
    const [product] = await fetchQuery(api.products.list, { limit: 1 });
    return [{ slug: product?.slug ?? PLACEHOLDER_HANDLE }];
  } catch {
    return [{ slug: PLACEHOLDER_HANDLE }];
  }
}

function getProductUrl(slug: string) {
  return new URL(routes.product(slug), baseUrl).toString();
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
  const description = product.description?.trim();
  if (description) return description.replace(/\s+/g, " ").slice(0, 160);
  return `${product.title} ürününü ${formatMoney(product.price)} fiyatıyla inceleyin.`;
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const params = await props.params;
  if (params.slug === PLACEHOLDER_HANDLE) return {};
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
  if (slug === PLACEHOLDER_HANDLE) return notFound();
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
              routes.category(product.categorySlug),
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

  const defaultVariant = getDefaultVariant(product);

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
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start lg:z-30">
            <Suspense fallback={<ProductGalleryShell product={product} />}>
              <Gallery key={product.id} product={product} defaultVariant={defaultVariant} />
            </Suspense>
          </div>

          <div className={productDetailsClassName}>
            <ProductDescription
              key={product.id}
              product={product}
              defaultVariant={defaultVariant}
              shareUrl={productUrl}
            />
          </div>
        </div>

        {/* Ürün Değerlendirmeleri ve Yıldız Puanlama */}
        <ProductReviews productId={product.id} />

        <ProductInfoTabs product={product} />

        {/* Product Recommendations & Upsells */}
        <Suspense fallback={null}>
          <ProductMerchandising product={product} />
        </Suspense>
      </div>
    </>
  );
}

function ProductGalleryShell({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>;
}) {
  const firstImage = product.images[0];

  if (!firstImage) return <ProductGallerySkeleton />;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={`${productGalleryClassName} bg-neutral-100 dark:bg-neutral-900`}>
        <Image
          src={firstImage.url}
          alt={product.title}
          fill
          sizes="(max-width: 1024px) 100vw, 540px"
          preload
          fetchPriority="high"
          className="object-contain"
        />
      </div>
      {product.images.length > 1 ? (
        <div className="flex items-center gap-2 py-1" aria-hidden="true">
          {product.images.slice(0, 5).map((image) => (
            <div key={image.url} className="size-16 rounded-xl bg-muted sm:size-20" />
          ))}
        </div>
      ) : null}
    </div>
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
    <>
      <RelatedProducts products={relatedProducts} />
      <BoughtTogetherShelf
        products={recommendationCatalog}
        sourceProducts={[product]}
        sourceProductIds={[product.id]}
      />
      <RecentlyViewedShelf excludeProductId={product.id} />
    </>
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
          href={routes.search}
          className="shrink-0 text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
        >
          Daha Fazla Gör
        </Link>
      }
    />
  );
}
