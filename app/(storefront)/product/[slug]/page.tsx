import { GridTileImage } from "@/components/grid/tile";
import Footer from "@/components/layout/footer";
import { Gallery } from "@/components/product/gallery";
import { ProductDescription } from "@/components/product/product-description";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import {
  BoughtTogetherShelf,
  ProductViewTracker,
} from "@/components/product/recommendation-shelves";
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
import { getProductImages } from "@/lib/catalog/product-images";
import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/outline";

function getProductUrl(slug: string) {
  return new URL(`/product/${slug}`, baseUrl).toString();
}

function getAbsoluteHttpImageUrls(images: string[]) {
  return images.flatMap((image) => {
    try {
      const url = new URL(image, baseUrl);
      return url.protocol === "https:" || url.protocol === "http:" ? [url.toString()] : [];
    } catch {
      return [];
    }
  });
}

function getProductDescription(product: NonNullable<Awaited<ReturnType<typeof getProduct>>>) {
  return `${product.title} ürününü ${product.price} TL fiyatıyla inceleyin.`;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.slug);

  if (!product) return notFound();

  const parentMetadata = await parent;
  const title = product.title;
  const description = getProductDescription(product);
  const productUrl = getProductUrl(product.slug);
  const imageUrls = getAbsoluteHttpImageUrls(product.images.map(({ url }) => url));

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

  const productImageUrls = getAbsoluteHttpImageUrls(product.images.map(({ url }) => url));
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
      ...(product.categorySlug ? [{
        "@type": "ListItem",
        position: 2,
        name: product.categorySlug,
        item: new URL(`/search/${product.categorySlug}`, baseUrl).toString(),
      }] : []),
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
      <ProductViewTracker slug={product.slug} />

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="py-4">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="flex items-center gap-1 transition hover:text-foreground">
                <HomeIcon className="size-3.5" />
                <span>Ana Sayfa</span>
              </Link>
            </li>
            {product.categorySlug && (
              <>
                <li>
                  <ChevronRightIcon className="size-3 text-muted-foreground/60" />
                </li>
                <li>
                  <Link
                    href={`/search/${product.categorySlug}`}
                    className="capitalize transition hover:text-foreground"
                  >
                    {product.categorySlug}
                  </Link>
                </li>
              </>
            )}
            <li>
              <ChevronRightIcon className="size-3 text-muted-foreground/60" />
            </li>
            <li className="line-clamp-1 font-medium text-foreground">
              {product.title}
            </li>
          </ol>
        </nav>

        {/* Product Details Grid */}
        <div className="grid grid-cols-1 gap-8 pb-10 sm:gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-start lg:gap-16 lg:pb-16">
          <div className="min-w-0 lg:sticky lg:top-24">
            <Suspense
              fallback={
                <div className="relative aspect-[4/5] w-full animate-pulse rounded-2xl bg-muted" />
              }
            >
              <Gallery product={product} />
            </Suspense>
          </div>

          <div className="min-w-0 lg:py-2">
            <Suspense fallback={null}>
              <ProductDescription product={product} />
            </Suspense>
          </div>
        </div>

        {/* Product Recommendations & Upsells */}
        <Suspense fallback={null}>
          <ProductMerchandising product={product} />
        </Suspense>
      </div>
      <Footer />
    </>
  );
}

async function ProductMerchandising({ product }: {
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

function ProductSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-16 lg:px-8 lg:py-12">
      <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-muted" />
      <div className="flex flex-col gap-5 pt-2 lg:pt-6">
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
        <div className="h-10 w-4/5 animate-pulse rounded-lg bg-muted" />
        <div className="h-7 w-1/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-px w-full bg-border" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-5 h-12 w-full animate-pulse rounded-xl bg-muted" />
      </div>
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

function RelatedProducts({ products }: { products: Awaited<ReturnType<typeof getProductRecommendations>> }) {
  if (!products.length) return null;

  return (
    <section className="py-8" aria-label="Benzer Ürünler">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Benzer Ürünler</h2>
        <Link
          href="/search"
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
        >
          Daha Fazla Gör
        </Link>
      </div>
      <ul className="flex w-full gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {products.map((product) => (
          <li
            key={product.slug}
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
          >
            <div className="relative h-full w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20">
              <Link
                className="relative block h-full w-full"
                href={`/product/${product.slug}`}
              >
                <GridTileImage
                  alt={product.title}
                  label={{
                    title: product.title,
                    amount: product.price,
                    currencyCode: "TRY",
                  }}
                  src={getProductImages(product)[0]?.url}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, (min-width: 475px) 50vw, 100vw"
                />
              </Link>
              <FavoriteButton
                product={product}
                className="absolute right-3 top-3 z-10 size-9"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
