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
import { getSameDayDispatchCountdown } from "@/lib/catalog/delivery-promise";
import { RestockAlert } from "./restock-alert";
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
  const [countdownNow, setCountdownNow] = useState(0);
  const purchaseActivity = useQuery(
    api.orders.getRecentPurchaseActivity,
    now > 0 ? { productId: product.id as Id<"products">, now } : "skip",
  );
  const availability = useQuery(api.products.getAvailability, {
    productId: product.id as Id<"products">,
  });
  const shippingSettings = useQuery(api.settings.getShippingPromiseSettings, {});
  const category = useQuery(api.categories.getBySlug, product.categorySlug ? { slug: product.categorySlug } : "skip");

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      setCountdownNow(currentTime);
    }, 0);
    const interval = window.setInterval(() => setCountdownNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(interval);
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

  const stockQuantity = availability === undefined
    ? product.stockQuantity ?? null
    : availability?.stockQuantity ?? null;
  const isAvailableForSale = availability === undefined
    ? product.availableForSale
    : availability?.availableForSale ?? false;
  const liveVariants = product.variants?.map((currentVariant) => {
    const live = availability?.variants.find((candidate) => candidate.id === currentVariant.id);
    return live
      ? { ...currentVariant, availableForSale: live.availableForSale, stockQuantity: live.stockQuantity }
      : currentVariant;
  });
  const variant = selectedVariant
    ? liveVariants?.find((candidate) => candidate.id === selectedVariant.id)
    : undefined;
  const selectedStockQuantity = variant
    ? variant.stockQuantity ?? stockQuantity
    : stockQuantity;
  const purchaseProduct = {
    ...product,
    ...(liveVariants ? { variants: liveVariants } : {}),
    stockQuantity: selectedStockQuantity,
    availableForSale: isAvailableForSale,
  };
  const dispatchCountdown = isAvailableForSale && selectedStockQuantity !== 0 &&
    (!variant || variant.availableForSale) && shippingSettings && countdownNow > 0
    ? getSameDayDispatchCountdown(
        countdownNow,
        shippingSettings.shippingCutoffMinutes,
        shippingSettings.shippingDays,
      )
    : null;
  const unitPrice = variant?.price?.amount ?? product.price;
  const priceRange = variant ? { min: unitPrice, max: unitPrice } : getProductPriceRange(product, searchParams);
  return (
    <>
      <div className="mb-6 flex flex-col border-b pb-6 dark:border-neutral-700">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white lg:text-5xl">
            {product.title}
          </h1>
          <FavoriteButton
            product={product}
            showLabel
            className="shrink-0"
          />
        </div>
        <div className="mr-auto mt-2 w-auto rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900 shadow-xs">
          <Price
            amount={priceRange.min}
            maxAmount={priceRange.max}
            currencyCode="TRY"
          />
        </div>
        {purchaseActivity && purchaseActivity.buyerCount > 0 && (
          <p role="status" aria-live="polite" className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
            Son 24 saatte {purchaseActivity.limited ? "en az " : ""}{purchaseActivity.buyerCount} alıcı bu ürünü satın aldı
          </p>
        )}
        {availability && (
          <p role="status" className={`mt-3 text-sm font-medium ${selectedStockQuantity === 0 ? "text-muted-foreground" : selectedStockQuantity !== null && selectedStockQuantity <= 3 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
            {selectedStockQuantity === 0
              ? "Stokta yok"
              : !(variant?.availableForSale ?? isAvailableForSale)
                ? "Ürün şu anda satışta değil"
                : selectedStockQuantity !== null && selectedStockQuantity <= 3
                  ? `Son ${selectedStockQuantity} ürün kaldı`
                  : selectedStockQuantity !== null
                    ? `Stokta ${selectedStockQuantity} ürün var`
                    : "Stokta"}
          </p>
        )}
        {dispatchCountdown && (
          <p className="mt-2 text-sm text-muted-foreground">
            {dispatchCountdown.hours > 0
              ? `${dispatchCountdown.hours} saat${dispatchCountdown.minutes > 0 ? ` ${dispatchCountdown.minutes} dakika` : ""}`
              : `${dispatchCountdown.minutes} dakika`} içinde sipariş verirseniz bugün kargoda
          </p>
        )}
      </div>

      {product.options && product.variants && (
        <VariantSelector options={product.options} variants={liveVariants ?? product.variants} />
      )}

      {availability?.productEnabledForSale && (
        variant
          ? !variant.availableForSale && (
            <RestockAlert
              productId={product.id as Id<"products">}
              productTitle={product.title}
              variantId={variant.id}
              variantTitle={variant.selectedOptions.length ? variant.title : undefined}
            />
          )
          : !product.options?.length && !isAvailableForSale && (
            <RestockAlert
              productId={product.id as Id<"products">}
              productTitle={product.title}
              variantId=""
            />
          )
      )}

      <div className="mt-8 space-y-3">
        {!isCartReplacement && <QuickBuyButton product={purchaseProduct} variant={variant} />}
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

      {product.attributes && product.attributes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Ürün Özellikleri
          </h3>
          <dl className="mt-3 divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {product.attributes.map((attr) => {
              const def = category?.attributes?.find((d) => d.key === attr.key);
              const label = def?.label ?? attr.key;
              let displayValue = "";
              if (Array.isArray(attr.value)) {
                displayValue = attr.value.join(", ");
              } else if (typeof attr.value === "boolean") {
                displayValue = attr.value ? "Evet" : "Hayır";
              } else {
                displayValue = String(attr.value) + (def?.unit ? ` ${def.unit}` : "");
              }

              return (
                <div key={attr.key} className="flex items-center justify-between py-2.5 text-xs">
                  <dt className="text-neutral-600 dark:text-neutral-400">{label}</dt>
                  <dd className="font-medium text-neutral-900 dark:text-neutral-100 text-right">{displayValue}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </>
  );
}
