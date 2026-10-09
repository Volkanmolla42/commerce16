"use client";

import type { Product, ProductVariant } from "@/lib/catalog/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight01Icon } from "hugeicons-react";
import { Button } from "@/components/ui";
import { setQuickBuyItem } from "./quick-buy-store";
import { getProductVariantTitle, getSelectedVariant } from "@/lib/catalog/variants";
import { getVariantImages } from "@/lib/catalog/product-images";

export function QuickBuyButton({ product, variant }: { product: Product; variant?: ProductVariant }) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const selectedVariant = variant ?? getSelectedVariant(product, new URLSearchParams());
  const needsSelection = Boolean(product.variants?.length && !selectedVariant);
  const isAvailable = product.availableForSale && !needsSelection && (selectedVariant?.availableForSale ?? true);

  const handleQuickBuy = () => {
    if (!isAvailable || isNavigating) return;

    setQuickBuyItem({
      product: selectedVariant
        ? { ...product, price: selectedVariant.price.amount, images: getVariantImages(product, selectedVariant), title: getProductVariantTitle(product.title, selectedVariant) }
        : product,
      quantity: 1,
      variantId: selectedVariant?.id,
    });
    setIsNavigating(true);
    router.push("/checkout?mode=quick-buy");
  };

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleQuickBuy}
      disabled={!isAvailable || isNavigating}
      aria-label="Hemen Satın Al"
      className="h-12 w-full rounded-xl text-sm font-semibold shadow-none gap-2"
    >
      {isNavigating ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          <span>Sipariş sayfası açılıyor...</span>
        </>
      ) : needsSelection ? (
        <span>Önce seçenekleri seçin</span>
      ) : !isAvailable ? (
        <span>Tükendi</span>
      ) : (
        <>
          <span>Hemen Satın Al</span>
          <ArrowRight01Icon className="h-5 w-5" />
        </>
      )}
    </Button>
  );
}
