import Price from "@/components/price";
import { Product } from "@/lib/catalog/types";
import { AddToCart } from "@/components/cart/add-to-cart";
import { VariantSelector } from "./variant-selector";

export function ProductDescription({ product }: { product: Product }) {
  return (
    <>
      <div className="mb-6 flex flex-col border-b pb-6 dark:border-neutral-700">
        <h1 className="mb-2 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {product.title}
        </h1>
        <div className="mr-auto mt-2 w-auto rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900 shadow-xs">
          <Price
            amount={product.price}
            currencyCode="USD"
          />
        </div>
      </div>

      {product.options && product.variants && (
        <VariantSelector options={product.options} variants={product.variants} />
      )}

      <div className="mt-8">
        <AddToCart product={product} />
      </div>
    </>
  );
}
