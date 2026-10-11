"use client";

import Grid from "@/components/grid";
import { GridTileImage } from "@/components/grid/tile";
import type { Product } from "@/lib/catalog/types";
import { ProductImageLink, ProductImageTransition } from "@/components/product/product-image-transition";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import Image from "next/image";
import Price from "@/components/price";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { getProductImages } from "@/lib/catalog/product-images";

export default function ProductGridItems({
  products,
  imageSizes = "(min-width: 1536px) 386px, (min-width: 1024px) calc(33.333vw - 126px), (min-width: 768px) calc(50vw - 181px), calc(50vw - 1.5rem)",
  prioritizeFirst = true,
  cardLayout = "overlay",
  imageFit = "cover",
  aspectRatio = "portrait",
}: {
  products: Product[];
  imageSizes?: string;
  prioritizeFirst?: boolean;
  cardLayout?: "overlay" | "stacked";
  imageFit?: "contain" | "cover";
  aspectRatio?: "portrait" | "square";
}) {
  return (
    <>
      {products.map((product, index) => {
        const priceRange = getProductPriceRange(product);
        const imageUrl = getProductImages(product)[0]?.url;
        const shouldLoadEagerly = prioritizeFirst && (
          index === 0 || (cardLayout === "stacked" && index < 3)
        );
        const shouldPrioritizeImage = prioritizeFirst && (
          index === 0 || (cardLayout === "stacked" && index === 1)
        );

        if (cardLayout === "stacked") {
          return (
            <Grid.Item key={product.slug} square={false} className="animate-fade-in">
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg">
                <ProductImageLink productId={product.id} href={`/product/${product.slug}`} className="flex h-full flex-col">
                  <div className={`relative w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 ${
                    aspectRatio === "square" ? "aspect-square" : "aspect-[4/5]"
                  }`}>
                    {imageUrl ? (
                      <ProductImageTransition><Image
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes={imageSizes}
                        loading={shouldLoadEagerly ? "eager" : "lazy"}
                        fetchPriority={shouldPrioritizeImage ? "high" : undefined}
                        className={
                          imageFit === "contain" ? "object-contain p-3" : "object-cover"
                        }
                      /></ProductImageTransition>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3 sm:p-3.5">
                    <h2 className="line-clamp-2 text-xs sm:text-[13px] font-medium leading-snug text-foreground">
                      {product.title}
                    </h2>
                    <Price
                      amount={priceRange.min}
                      maxAmount={priceRange.max}
                      currencyCode="TRY"
                      currencyCodeClassName="text-[10px] font-normal text-muted-foreground"
                      className="flex flex-wrap items-baseline text-sm font-semibold text-foreground"
                    />
                  </div>
                </ProductImageLink>
                <FavoriteButton
                  product={product}
                  className="absolute right-3 top-3 z-10 size-9 min-h-9 min-w-9 shadow-md"
                />
              </article>
            </Grid.Item>
          );
        }

        return (
          <Grid.Item key={product.slug} className="animate-fade-in">
            <div className="relative h-full w-full">
              <ProductImageLink productId={product.id}
                className="relative block h-full w-full"
                href={`/product/${product.slug}`}
              >
                <GridTileImage
                  alt={product.title}
                  label={{
                    title: product.title,
                    amount: priceRange.min,
                    maxAmount: priceRange.max,
                    currencyCode: "TRY",
                  }}
                  src={imageUrl}
                  transitionImage
                  fill
                  sizes={imageSizes}
                  loading={shouldLoadEagerly ? "eager" : "lazy"}
                  fetchPriority={shouldPrioritizeImage ? "high" : undefined}
                />
              </ProductImageLink>
              <FavoriteButton
                product={product}
                className="absolute right-3 top-3 z-10 h-11 w-11"
              />
            </div>
          </Grid.Item>
        );
      })}
    </>
  );
}
