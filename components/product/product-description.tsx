"use client";

import Price from "@/components/price";
import { Product } from "@/lib/catalog/types";
import { AddToCart } from "@/components/cart/add-to-cart";
import { VariantSelector } from "./variant-selector";
import { useSearchParams } from "next/navigation";
import { getSelectedVariant } from "@/lib/catalog/variants";

export function ProductDescription({ product }: { product: Product }) {
  const variant = getSelectedVariant(product, useSearchParams());
  return (
    <>
      <div className="mb-6 flex flex-col border-b pb-6 dark:border-neutral-700">
        <h1 className="mb-2 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {product.title}
        </h1>
        <div className="mr-auto mt-2 w-auto rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900 shadow-xs">
          <Price
            amount={variant?.price.amount ?? product.price}
            currencyCode="TRY"
          />
        </div>
      </div>

      {product.options && product.variants && (
        <VariantSelector options={product.options} variants={product.variants} />
      )}

      <div className="mt-8">
        <AddToCart product={product} variant={variant} />
      </div>
    </>
  );
}
