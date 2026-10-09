"use client";

import Grid from "@/components/grid";
import { GridTileImage } from "@/components/grid/tile";
import type { Product } from "@/lib/catalog/types";
import Link from "next/link";
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
  imageFit = "contain",
}: {
  products: Product[];
  imageSizes?: string;
  prioritizeFirst?: boolean;
  cardLayout?: "overlay" | "stacked";
  imageFit?: "contain" | "cover";
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
              <article className="relative h-full overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-blue-500/40">
                <Link href={`/product/${product.slug}`} className="block h-full">
                  <div className="relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-950">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes={imageSizes}
                        loading={shouldLoadEagerly ? "eager" : "lazy"}
                        fetchPriority={shouldPrioritizeImage ? "high" : undefined}
                        className={`${imageFit === "cover" ? "object-cover" : "object-contain p-3 sm:p-4"}`}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2 p-3 sm:p-4">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
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
                </Link>
                <FavoriteButton
                  product={product}
                  className="absolute right-3 top-3 z-10 h-10 w-10"
                />
              </article>
            </Grid.Item>
          );
        }

        return (
          <Grid.Item key={product.slug} className="animate-fade-in">
            <div className="relative h-full w-full">
              <Link
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
                  fill
                  sizes={imageSizes}
                  loading={shouldLoadEagerly ? "eager" : "lazy"}
                  fetchPriority={shouldPrioritizeImage ? "high" : undefined}
                />
              </Link>
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
