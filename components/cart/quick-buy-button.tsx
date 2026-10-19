"use client";

import type { Product, ProductVariant } from "@/lib/catalog/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { setQuickBuyItem } from "./quick-buy-store";
import { getSelectedVariant, getVariantProduct } from "@/lib/catalog/variants";

export function QuickBuyButton({ product, variant, buttonVariant = "default" }: { product: Product; variant?: ProductVariant; buttonVariant?: "default" | "outline" }) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const selectedVariant = variant ?? getSelectedVariant(product, new URLSearchParams());
  const needsSelection = Boolean(product.variants?.length && !selectedVariant);
  const isAvailable = product.availableForSale && !needsSelection && (selectedVariant?.availableForSale ?? true);

  const handleQuickBuy = () => {
    if (!isAvailable || isNavigating) return;

    setQuickBuyItem({
      product: selectedVariant ? getVariantProduct(product, selectedVariant) : product,
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
      variant={buttonVariant}
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
          <ArrowRightIcon className="h-5 w-5" />
        </>
      )}
    </Button>
  );
}
