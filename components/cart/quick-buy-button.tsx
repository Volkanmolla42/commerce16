"use client";

import type { Product, ProductVariant } from "@/lib/catalog/types";
import { useState } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useQuickBuy } from "./quick-buy-store";
import { getProductPurchaseState } from "@/lib/catalog/variants";

export function QuickBuyButton({ product, variant, buttonVariant = "default" }: { product: Product; variant?: ProductVariant; buttonVariant?: "default" | "outline" }) {
  const startQuickBuy = useQuickBuy();
  const [isNavigating, setIsNavigating] = useState(false);
  const { selectedVariant, selectedProduct, needsSelection, isAvailable } = getProductPurchaseState(product, variant);

  const handleQuickBuy = () => {
    if (!isAvailable || isNavigating) return;

    setIsNavigating(true);
    startQuickBuy(selectedProduct, selectedVariant?.id);
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
