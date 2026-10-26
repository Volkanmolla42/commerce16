import { Suspense } from "react";

import Price from "@/components/price";
import type { Product, ProductVariant } from "@/lib/catalog/types";
import { getStoreSettings } from "@/lib/catalog";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { DeliveryEstimate } from "./delivery-estimate";

import { ProductDescriptionControls } from "./product-description-controls";
import { ShareButtons } from "./share-buttons";

export function ProductDescription({
  product,
  defaultVariant,
  shareUrl,
}: {
  product: Product;
  defaultVariant?: ProductVariant;
  shareUrl: string;
}) {
  const priceRange = getProductPriceRange(product);
  const hasVariablePrice =
    priceRange.min !== priceRange.max ||
    new Set(product.variants?.map((variant) => `${variant.price}:${variant.compareAtPrice ?? ""}`)).size > 1;

  return (
    <section className="mx-auto w-full max-w-[640px] lg:mx-0">
      <header className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl xl:text-4xl">
            {product.title}
          </h1>
          <ShareButtons url={shareUrl} title={product.title} />
        </div>
        {!hasVariablePrice ? (
          <div className="mt-3">
            <Price
              amount={defaultVariant?.price ?? priceRange.min}
              compareAtAmount={defaultVariant?.compareAtPrice}
              className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
            />
          </div>
        ) : null}
      </header>
      <ProductPurchaseDetails
        product={product}
        defaultVariant={defaultVariant}
        hasVariablePrice={hasVariablePrice}
      />
    </section>
  );
}

function ProductPurchaseDetails({
  product,
  defaultVariant,
  hasVariablePrice,
}: {
  product: Product;
  defaultVariant?: ProductVariant;
  hasVariablePrice: boolean;
}) {
  return (
    <>
      <ProductDescriptionControls
        product={product}
        defaultVariant={defaultVariant}
        hasVariablePrice={hasVariablePrice}
      />
      <Suspense fallback={null}>
        <ProductDeliveryDetails product={product} />
      </Suspense>
    </>
  );
}

async function ProductDeliveryDetails({ product }: { product: Product }) {
  const { shippingCutoffHour, shippingEstimate } = await getStoreSettings();
  return (
    <DeliveryEstimate
      cutoffHour={shippingCutoffHour}
      estimate={shippingEstimate}
      available={product.availableForSale}
    />
  );
}
