"use client";

import { productPurchaseBarClassName } from "./product-layout";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import Price from "@/components/price";
import { Product } from "@/lib/catalog/types";
import { AddToCart } from "@/components/cart/add-to-cart";
import { VariantSelector } from "./variant-selector";
import { useSearchParams } from "next/navigation";
import {
  getProductPriceRange,
  getSelectedVariant,
} from "@/lib/catalog/variants";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { QuickBuyButton } from "@/components/cart/quick-buy-button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui";
import { notifyProductAddedToCart } from "@/components/cart/product-cart-feedback";
import { ChevronDownIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

export function ProductDescription({ product }: { product: Product }) {
  const searchParams = useSearchParams();
  const optionsRef = useRef<HTMLDivElement>(null);
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
  const selectedVariant = getSelectedVariant(product, searchParams);
  const [now, setNow] = useState(0);
  const purchaseActivity = useQuery(
    api.orders.getRecentPurchaseActivity,
    now > 0 ? { productId: product.id as Id<"products">, now } : "skip",
  );
  const availability = useQuery(api.products.getAvailability, {
    productId: product.id as Id<"products">,
  });
  const category = useQuery(
    api.categories.getBySlug,
    product.categorySlug ? { slug: product.categorySlug } : "skip",
  );

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

  const isAvailableForSale =
    availability === undefined
      ? product.availableForSale
      : (availability?.availableForSale ?? false);
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
  const unitPrice = variant?.price.amount ?? product.price;
  const priceRange = variant
    ? { min: unitPrice, max: unitPrice }
    : getProductPriceRange(product, searchParams);
  const needsVariantSelection = Boolean(
    product.variants?.length && !selectedVariant,
  );
  const visibleAttributes =
    product.attributes?.flatMap((attribute) => {
      const definition = category?.attributes?.find(
        (candidate) => candidate.key === attribute.key,
      );
      return definition?.label ? [{ attribute, definition }] : [];
    }) ?? [];

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <header className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl xl:text-4xl">
              {product.title}
            </h1>
          </div>
          <FavoriteButton
            product={product}
            className="mt-1 shrink-0 border-neutral-300 bg-transparent text-neutral-600 shadow-none hover:bg-neutral-100 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-900"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
            currencyCode="TRY"
            className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
            currencyCodeClassName="sr-only"
          />
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${isAvailableForSale && (!variant || variant.availableForSale) ? "bg-emerald-500" : "bg-neutral-400"}`}
              aria-hidden="true"
            />
            {isAvailableForSale
              ? variant && !variant.availableForSale
                ? "Seçili seçenek tükendi"
                : "Stokta"
              : "Şu anda stokta yok"}
          </p>
        </div>
        {purchaseActivity && purchaseActivity.buyerCount > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span>
              Son 24 saatte {purchaseActivity.limited ? "en az " : ""}
              {purchaseActivity.buyerCount} kişi bu ürünü satın aldı
            </span>
          </div>
        )}
      </header>

      {product.options && product.variants && (
        <div ref={optionsRef} className="scroll-mt-24 pt-5">
          {needsVariantSelection ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Sipariş vermek için seçeneklerinizi belirleyin.
            </p>
          ) : null}
          <VariantSelector
            options={product.options}
            variants={liveVariants ?? product.variants}
          />
        </div>
      )}

      <div data-product-purchase-bar className={productPurchaseBarClassName}>
        <Price
          amount={priceRange.min}
          maxAmount={priceRange.max}
          currencyCodeClassName="sr-only"
          className="max-w-[40%] shrink-0 text-sm font-semibold text-foreground md:hidden"
        />
        <div className="min-w-0 flex-1">
          {needsVariantSelection && isAvailableForSale ? (
            <Button
              className="h-12 w-full rounded-xl"
              onClick={() => {
                optionsRef.current?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                  block: "center",
                });
                optionsRef.current
                  ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                  ?.focus({ preventScroll: true });
              }}
            >
              Seçenekleri seç{" "}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <AddToCart
              onAdded={notifyProductAddedToCart}
              hideCartLinkOnMobile
              product={purchaseProduct}
              variant={variant}
              replaceCartItem={
                replacementSource
                  ? {
                      productId: replacementSource.product.id,
                      variantId: replacementSource.variantId,
                      quantity: replacementSource.quantity,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
      {!isCartReplacement && !needsVariantSelection && isAvailableForSale && (
        <div className="mt-3">
          <QuickBuyButton
            product={purchaseProduct}
            variant={variant}
            buttonVariant="outline"
          />
        </div>
      )}
      <div className="mt-6 divide-y divide-border border-y border-border">
        <details className="group py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
            Teslimat ve iade{" "}
            <ChevronDownIcon
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="pb-2 text-sm leading-6 text-muted-foreground">
            Sipariş öncesinde teslimat, cayma hakkı ve iade koşullarını
            inceleyebilirsiniz.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link
              href="/pre-information-form"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Teslimat bilgileri
            </Link>
            <Link
              href="/distance-sales-agreement"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              İade koşulları
            </Link>
          </div>
        </details>
      </div>

      {visibleAttributes.length > 0 && category !== undefined && (
        <section className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Ürün özellikleri
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {visibleAttributes.map(({ attribute, definition }) => {
              const value = Array.isArray(attribute.value)
                ? attribute.value.join(", ")
                : typeof attribute.value === "boolean"
                  ? attribute.value
                    ? "Evet"
                    : "Hayır"
                  : String(attribute.value);

              return (
                <div key={attribute.key} className="min-w-0">
                  <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                    {definition.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {value}
                    {definition.unit ? ` ${definition.unit}` : ""}
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
