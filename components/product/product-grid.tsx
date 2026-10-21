"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ProductImageLink, ProductImageTransition } from "./product-image-transition";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import Price from "@/components/price";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { ProductBadges } from "./product-badges";
import { ProductCardActions } from "./product-card-actions";
import type { Product } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

const scrollGridClassName =
  "grid-flow-col auto-cols-[minmax(11rem,72vw)] gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [&>*]:[scroll-snap-align:start] sm:auto-cols-[14rem] sm:gap-4 lg:auto-cols-[16rem]";

interface ProductGridProps {
  products: Product[];
  layout?: "grid" | "scroll";
  className?: string;
  href?: (product: Product) => string;
  action?: (product: Product) => ReactNode;
}

export function ProductGrid({
  products,
  layout = "grid",
  className,
  href,
  action,
}: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <ul
      className={cn(
        "grid gap-4",
        layout === "scroll"
          ? scrollGridClassName
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {products.map((product, index) => (
        <li key={product.slug} className="animate-fade-in">
          <ProductCard
            product={product}
            href={href?.(product)}
            priority={layout !== "scroll" && index < 2}
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
  priority = false,
  action,
}: {
  product: Product;
  href?: string;
  priority?: boolean;
  action?: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = product.images.slice(0, 4);
  const hasMultipleImages = images.length > 1;
  const priceRange = getProductPriceRange(product);
  const soldOut = product.inStock === false;
  const imageSizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";

  return (
    <article
      onMouseLeave={() => setActiveIndex(0)}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg"
    >
      <ProductImageLink
        productId={product.id}
        href={href ?? `/product/${product.slug}`}
        className="flex h-full flex-col"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {images.length > 0 ? (
            <ProductImageTransition>
              {images.map((img, index) => (
                <Image
                  key={img.url}
                  src={img.url}
                  alt={product.title}
                  fill
                  sizes={imageSizes}
                  preload={priority && index === 0}
                  className={cn(
                    "object-cover transition-opacity duration-300 ease-out",
                    index === activeIndex
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  )}
                />
              ))}
            </ProductImageTransition>
          ) : null}
          {soldOut ? (
            <span className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-background/60">
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">Tükendi</span>
            </span>
          ) : null}
          {hasMultipleImages ? (
            <div
              className="absolute inset-0 z-[1] flex"
              onMouseLeave={() => setActiveIndex(0)}
            >
              {images.map((_, index) => (
                <span
                  key={index}
                  className="h-full flex-1"
                  onMouseEnter={() => setActiveIndex(index)}
                />
              ))}
            </div>
          ) : null}
          {hasMultipleImages ? (
            <div className="pointer-events-none absolute bottom-2 inset-x-2 z-10 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {images.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-all duration-150",
                    index === activeIndex
                      ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                      : "bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  )}
                />
              ))}
            </div>
          ) : null}
          <div className="pointer-events-none absolute left-2 top-2 z-10">
            <ProductBadges
              variants={product.variants}
              _creationTime={product._creationTime}
              soldCount={product.soldCount}
              compact
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3 sm:p-3.5">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground sm:text-[13px]">
            {product.title}
          </h3>
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
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
