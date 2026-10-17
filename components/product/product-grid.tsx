"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import Image from "next/image";
import { ProductImageLink, ProductImageTransition } from "./product-image-transition";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import Price from "@/components/price";
import { getProductImages } from "@/lib/catalog/product-images";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { ProductBadges } from "./product-badges";
import { ProductCardActions } from "./product-card-actions";
import type { Product } from "@/lib/catalog/types";

const defaultImageSizes =
  "(min-width: 1536px) 386px, (min-width: 1024px) calc(33.333vw - 126px), (min-width: 768px) calc(50vw - 181px), calc(50vw - 1.5rem)";

const scrollGridClassName =
  "grid-flow-col auto-cols-[minmax(11rem,72vw)] gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [&>*]:[scroll-snap-align:start] sm:auto-cols-[14rem] sm:gap-4 lg:auto-cols-[16rem]";

/** Ürünleri tek biçimde render eden liste. `layout="scroll"` yatay raf, varsayılan ızgara. */
export function ProductGrid({
  products,
  layout = "grid",
  className,
  imageSizes = defaultImageSizes,
  prioritizeFirst = true,
  href,
  action,
}: {
  products: Product[];
  layout?: "grid" | "scroll";
  className?: string;
  imageSizes?: string;
  prioritizeFirst?: boolean;
  href?: (product: Product) => string;
  action?: (product: Product) => ReactNode;
}) {
  return (
    <ul className={clsx("grid gap-4", layout === "scroll" && scrollGridClassName, className)}>
      {products.map((product, index) => (
        <li key={product.slug} className="animate-fade-in">
          <ProductCard
            product={product}
            href={href?.(product)}
            imageSizes={imageSizes}
            priority={prioritizeFirst && index < 2}
            action={action?.(product)}
          />
        </li>
      ))}
    </ul>
  );
}

function ProductCard({
  product,
  href,
  imageSizes,
  priority = false,
  action,
}: {
  product: Product;
  href?: string;
  imageSizes: string;
  priority?: boolean;
  action?: ReactNode;
}) {
  const priceRange = getProductPriceRange(product);
  const images = getProductImages(product);
  const imageUrl = images[0]?.url;
  const hoverImageUrl = images[1]?.url;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg">
      <ProductImageLink
        productId={product.id}
        href={href ?? `/product/${product.slug}`}
        className="flex h-full flex-col"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {imageUrl ? (
            <ProductImageTransition>
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                sizes={imageSizes}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                className="object-cover"
              />
            </ProductImageTransition>
          ) : null}
          {hoverImageUrl && hoverImageUrl !== imageUrl ? (
            <Image
              src={hoverImageUrl}
              alt=""
              fill
              sizes={imageSizes}
              loading="lazy"
              fetchPriority="low"
              className="pointer-events-none absolute inset-0 z-[1] hidden object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:block"
            />
          ) : null}
          <div className="pointer-events-none absolute left-2 top-2 z-10">
            <ProductBadges
              variants={product.variants}
              createdAt={product.createdAt}
              publishedAt={product.publishedAt}
              soldCount={product.soldCount}
              compact
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3 sm:p-3.5">
          <h2 className="line-clamp-2 text-xs font-medium leading-snug text-foreground sm:text-[13px]">
            {product.title}
          </h2>
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
            currencyCode="TRY"
            className="flex flex-wrap items-baseline text-sm font-semibold text-foreground"
          />
        </div>
      </ProductImageLink>
      {action ? (
        <div className="flex flex-col gap-2 px-3 pb-3 sm:px-3.5 sm:pb-3.5">{action}</div>
      ) : (
        <ProductCardActions product={product} />
      )}
      <FavoriteButton
        product={product}
        className="absolute right-3 top-3 z-10 size-9 min-h-9 min-w-9 shadow-md"
      />
    </article>
  );
}
