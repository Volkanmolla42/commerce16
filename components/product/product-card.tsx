"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ProductImageLink, ProductImageTransition } from "./product-image-transition";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import Price from "@/components/price";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { getProductImages } from "@/lib/catalog/product-images";
import type { Product } from "@/lib/catalog/types";

/** Tüm ürün raflarının kullandığı ortak yatay kaydırma düzeni — kart genişlikleri tek yerden yönetilir. */
export const productShelfGridClassName =
  "grid-flow-col auto-cols-[minmax(11rem,72vw)] gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [&>*]:[scroll-snap-align:start] sm:auto-cols-[14rem] sm:gap-4 lg:auto-cols-[16rem]";

/**
 * Tek ürün kartı görünümü: görsel, başlık, fiyat ve favori butonu.
 * `action` verilirse kartın altına eylem butonu (sepete ekle vb.) eklenir.
 */
export function ProductCard({
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
  const imageUrl = getProductImages(product)[0]?.url;

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
      ) : null}
      <FavoriteButton
        product={product}
        className="absolute right-3 top-3 z-10 size-9 min-h-9 min-w-9 shadow-md"
      />
    </article>
  );
}
