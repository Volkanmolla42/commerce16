"use client";

import Grid from "@/components/grid";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/catalog/types";

export default function ProductGridItems({
  products,
  imageSizes = "(min-width: 1536px) 386px, (min-width: 1024px) calc(33.333vw - 126px), (min-width: 768px) calc(50vw - 181px), calc(50vw - 1.5rem)",
  prioritizeFirst = true,
}: {
  products: Product[];
  imageSizes?: string;
  prioritizeFirst?: boolean;
}) {
  return (
    <>
      {products.map((product, index) => (
        <Grid.Item key={product.slug} square={false} className="animate-fade-in">
          <ProductCard
            product={product}
            imageSizes={imageSizes}
            priority={prioritizeFirst && index < 2}
          />
        </Grid.Item>
      ))}
    </>
  );
}
