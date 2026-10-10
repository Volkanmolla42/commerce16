"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import Price from "@/components/price";
import { Product } from "@/lib/catalog/types";
import { AddToCart } from "@/components/cart/add-to-cart";
import { VariantSelector } from "./variant-selector";
import { useSearchParams } from "next/navigation";
import { getProductPriceRange, getSelectedVariant } from "@/lib/catalog/variants";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { QuickBuyButton } from "@/components/cart/quick-buy-button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCart } from "@/components/cart/cart-context";

export function ProductDescription({ product }: { product: Product }) {
  const searchParams = useSearchParams();
  const { items } = useCart();
  const replacementProductId = searchParams.get("cartReplaceProductId");
  const isCartReplacement = Boolean(replacementProductId);
  const replacementVariantId = searchParams.get("cartReplaceVariantId") ?? undefined;
  const replacementSource = replacementProductId
    ? items.find((item) => item.product.id === replacementProductId && item.variantId === replacementVariantId)
    : undefined;
  const selectedVariant = getSelectedVariant(product, searchParams);
  const [now, setNow] = useState(0);
  const purchaseActivity = useQuery(
    api.orders.getRecentPurchaseActivity,
    now > 0 ? { productId: product.id as Id<"products">, now } : "skip",
  );
  const availability = useQuery(api.products.getAvailability, {
    productId: product.id as Id<"products">,
  });
  const category = useQuery(api.categories.getBySlug, product.categorySlug ? { slug: product.categorySlug } : "skip");

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const currentTime = Date.now();
      setNow(currentTime);
    }, 0);
    return () => {
      window.clearTimeout(initialize);
    };
  }, []);
  useEffect(() => {
    if (!purchaseActivity?.expiresAt) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(1, purchaseActivity.expiresAt - Date.now() + 50),
    );
    return () => window.clearTimeout(timer);
  }, [purchaseActivity?.expiresAt]);

  const isAvailableForSale = availability === undefined
    ? product.availableForSale
    : availability?.availableForSale ?? false;
  const liveVariants = product.variants?.map((currentVariant) => {
    const live = availability?.variants.find((candidate) => candidate.id === currentVariant.id);
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
  const unitPrice = variant?.price.amount ?? product.price;
  const priceRange = variant ? { min: unitPrice, max: unitPrice } : getProductPriceRange(product, searchParams);
  const needsVariantSelection = Boolean(product.variants?.length && !selectedVariant);
  const visibleAttributes = product.attributes?.flatMap((attribute) => {
    const definition = category?.attributes?.find((candidate) => candidate.key === attribute.key);
    return definition?.label ? [{ attribute, definition }] : [];
  }) ?? [];

  return (
    <section className="mx-auto w-full max-w-[560px]">
        <header className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold leading-[1.08] tracking-tight text-neutral-950 sm:text-4xl dark:text-white">
                {product.title}
              </h1>
            </div>
            <FavoriteButton
              product={product}
              className="mt-1 shrink-0 border-neutral-300 bg-transparent text-neutral-600 shadow-none hover:bg-neutral-100 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-900"
            />
          </div>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Price
              amount={priceRange.min}
              maxAmount={priceRange.max}
              currencyCode="TRY"
              className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
            />
          </div>
          {purchaseActivity && purchaseActivity.buyerCount > 0 && (
            <div role="status" aria-live="polite" className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span>
                Son 24 saatte {purchaseActivity.limited ? "en az " : ""}{purchaseActivity.buyerCount} kişi bu ürünü satın aldı
              </span>
            </div>
          )}
        </header>

        {product.options && product.variants && (
          <div className="pt-6">
            <VariantSelector options={product.options} variants={liveVariants ?? product.variants} />
          </div>
        )}

        <div className="mt-6 space-y-3">
          {!isCartReplacement && !needsVariantSelection && (
            <QuickBuyButton product={purchaseProduct} variant={variant} />
          )}
          <AddToCart
            product={purchaseProduct}
            variant={variant}
            buttonVariant="outline"
            replaceCartItem={replacementSource ? {
              productId: replacementSource.product.id,
              variantId: replacementSource.variantId,
              quantity: replacementSource.quantity,
            } : undefined}
          />
        </div>

        {/* Customer Reassurance / Trust Badges */}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-background text-foreground shadow-2xs">✓</span>
            <span>Hızlı Teslimat</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-background text-foreground shadow-2xs">✓</span>
            <span>14 Gün İade Hakkı</span>
          </div>
          <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
            <span className="grid size-6 place-items-center rounded-lg bg-background text-foreground shadow-2xs">✓</span>
            <span>Güvenli Alışveriş</span>
          </div>
        </div>

        {visibleAttributes.length > 0 && category !== undefined && (
          <section className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Ürün özellikleri</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {visibleAttributes.map(({ attribute, definition }) => {
                const value = Array.isArray(attribute.value)
                  ? attribute.value.join(", ")
                  : typeof attribute.value === "boolean"
                    ? attribute.value ? "Evet" : "Hayır"
                    : String(attribute.value);

                return (
                  <div key={attribute.key} className="min-w-0">
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">{definition.label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {value}{definition.unit ? ` ${definition.unit}` : ""}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}
    </section>
  );
}
