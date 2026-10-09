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
  const imageUrls = getAbsoluteHttpImageUrls(product.images);

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

  const productImageUrls = getAbsoluteHttpImageUrls(product.images);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${getProductUrl(product.slug)}#product`,
    name: product.title,
    description: getProductDescription(product),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.material ? { material: product.material } : {}),
    url: getProductUrl(product.slug),
    ...(productImageUrls.length > 0 ? { image: productImageUrls } : {}),
    offers: {
      "@type": "Offer",
      url: getProductUrl(product.slug),
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      priceCurrency: "TRY",
      price: product.price,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductViewTracker slug={product.slug} />
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4">
        <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-8 md:p-12 lg:flex-row lg:gap-8 dark:border-neutral-800 dark:bg-black">
          <div className="h-full w-full basis-full lg:basis-4/6">
            <Suspense
              fallback={
                <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden" />
              }
            >
              <Gallery
                images={product.images.slice(0, 5).map((image: string) => ({
                  src: image,
                  altText: product.title,
                }))}
              />
            </Suspense>
          </div>

          <div className="basis-full lg:basis-2/6">
            <Suspense fallback={null}>
              <ProductDescription product={product} />
            </Suspense>
          </div>
        </div>
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
    <>
      <RelatedProducts products={relatedProducts} />
      <BoughtTogetherShelf
        products={recommendationCatalog}
        sourceProducts={[product]}
        sourceProductIds={[product.id]}
      />
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4">
      <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-8 md:p-12 lg:flex-row lg:gap-8 dark:border-neutral-800 dark:bg-black animate-pulse">
        <div className="aspect-square h-full min-h-[350px] max-h-[550px] w-full basis-full rounded-md bg-neutral-200 lg:basis-4/6 dark:bg-neutral-800" />
        <div className="flex flex-col gap-4 basis-full lg:basis-2/6 pt-6 lg:pt-0">
          <div className="h-8 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-6 w-1/4 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-24 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-8 h-12 w-full rounded-full bg-neutral-200 dark:bg-neutral-800" />
        </div>
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
  const relatedProducts = products;
  if (!relatedProducts.length) return null;

  return (
    <div className="py-8">
      <h2 className="mb-4 text-2xl font-bold">Benzer Ürünler</h2>
      <ul className="flex w-full gap-4 overflow-x-auto pt-1">
        {relatedProducts.map((product) => (
          <li
            key={product.slug}
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
          >
            <div className="relative h-full w-full">
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
                  src={product.images[0]}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, (min-width: 475px) 50vw, 100vw"
                />
              </Link>
              <FavoriteButton
                product={product}
                className="absolute right-3 top-3 z-10 h-11 w-11"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
