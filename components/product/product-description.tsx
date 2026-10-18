"use client";

import { productPurchaseBarClassName } from "./product-layout";
import { useQuery } from "convex/react";
import Price from "@/components/price";
import { Product, ProductVariant } from "@/lib/catalog/types";
import { AddToCart } from "@/components/cart/add-to-cart";
import { VariantSelector } from "./variant-selector";
import { useSearchParams } from "next/navigation";
import {
  getProductPriceRange,
  getSelectedVariant,
} from "@/lib/catalog/variants";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { DeliveryEstimate } from "./delivery-estimate";
import { ProductSocialProof } from "./product-social-proof";
import { ShareButtons } from "./share-buttons";
import { QuickBuyButton } from "@/components/cart/quick-buy-button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCart } from "@/components/cart/cart-context";
import { notifyProductAddedToCart } from "@/components/cart/product-cart-feedback";
import { StarRating } from "./star-rating";

export function ProductDescription({
  product,
  defaultVariant,
  shippingCutoffHour,
  shippingEstimate,
  shareUrl,
}: {
  product: Product;
  defaultVariant?: ProductVariant;
  shippingCutoffHour: number;
  shippingEstimate: string;
  shareUrl: string;
}) {
  const searchParams = useSearchParams();
  const { items } = useCart();
  const replacementProductId = searchParams.get("cartReplaceProductId");
  const isCartReplacement = Boolean(replacementProductId);
  const replacementVariantId =
    searchParams.get("cartReplaceVariantId") ?? undefined;
  const replacementSource = replacementProductId
    ? items.find(
      (item) =>
        item.product.id === replacementProductId &&
        item.variantId === replacementVariantId,
    )
    : undefined;
  const selectedVariant = getSelectedVariant(product, searchParams) ?? defaultVariant;
  const availability = useQuery(api.products.getAvailability, {
    productId: product.id as Id<"products">,
  });
  const ratingSummary = useQuery(api.reviews.getSummary, {
    productId: product.id as Id<"products">,
  });

  const isAvailableForSale = availability
    ? availability.availableForSale
    : product.availableForSale;
  const liveVariants = product.variants?.map((currentVariant) => {
    const live = availability?.variants.find(
      (candidate) => candidate.id === currentVariant.id,
    );
    return live
      ? { ...currentVariant, availableForSale: live.availableForSale }
      : currentVariant;
  });
  const variant = selectedVariant
    ? liveVariants?.find((candidate) => candidate.id === selectedVariant.id)
    : undefined;
  const purchaseProduct = {
    ...product,
    ...(liveVariants ? { variants: liveVariants } : {}),
    availableForSale: isAvailableForSale,
  };
  const priceRange = variant
    ? { min: variant.price.amount, max: variant.price.amount }
    : getProductPriceRange(product, searchParams);
  const canQuickBuy = !isCartReplacement && isAvailableForSale && (!variant || variant.availableForSale);
  const replaceCartItem = replacementSource
    ? {
      productId: replacementSource.product.id,
      variantId: replacementSource.variantId,
      quantity: replacementSource.quantity,
    }
    : undefined;

  return (
    <section className="mx-auto w-full max-w-[640px] lg:mx-0">
      <header className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl xl:text-4xl">
            {product.title}
          </h1>
          <ShareButtons url={shareUrl} title={product.title} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <a
            href="#degerlendirmeler"
            className="group inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
          >
            <StarRating
              rating={ratingSummary?.averageRating ?? 0}
              reviewCount={ratingSummary?.reviewCount ?? 0}
              size="sm"
            />
          </a>
          <ProductSocialProof productId={product.id} productSlug={product.slug} />
        </div>
        <div className="mt-3">
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
            compareAtAmount={variant?.compareAtPrice}
            currencyCode="TRY"
            className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
          />
        </div>
      </header>

      {product.options && product.variants && (
        <div className="scroll-mt-24 pt-5">
          <VariantSelector
            options={product.options}
            variants={liveVariants ?? product.variants}
            selectedVariant={selectedVariant}
          />
        </div>
      )}

      <div className="md:mt-5 md:flex md:items-center md:gap-3">
        <div data-product-purchase-bar className={`${productPurchaseBarClassName} md:flex-1`}>
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
            className="max-w-[40%] shrink-0 text-sm font-semibold text-foreground md:hidden"
          />
          <div className="min-w-0 flex-1">
            <AddToCart
              onAdded={notifyProductAddedToCart}
              product={purchaseProduct}
              variant={variant}
              replaceCartItem={replaceCartItem}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 md:mt-0 md:flex-1">
          <div className="min-w-0 flex-1">
            {canQuickBuy ? (
              <QuickBuyButton
                product={purchaseProduct}
                variant={variant}
                buttonVariant="outline"
              />
            ) : null}
          </div>
          <FavoriteButton
            product={product}
            className="size-12 min-h-12 min-w-12 shrink-0 rounded-xl border-border bg-background text-muted-foreground shadow-none hover:bg-muted hover:text-rose-600 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-muted"
          />
        </div>
      </div>
      <DeliveryEstimate
        cutoffHour={shippingCutoffHour}
        estimate={shippingEstimate}
        available={isAvailableForSale}
      />
    </section>
  );
}
