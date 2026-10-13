"use client";

import { useCart } from "./cart-context";
import type { Product, ProductVariant } from "@/lib/catalog/types";
import { useEffect, useRef, useState } from "react";
import { ShoppingBagIcon, CheckIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getProductVariantTitle, getSelectedVariant } from "@/lib/catalog/variants";
import { getVariantImages } from "@/lib/catalog/product-images";
import { burstCartConfetti } from "./cart-confetti";
import { RestockNotificationDialog } from "@/components/product/restock-notification-dialog";

export function AddToCart({
  product,
  variant,
  buttonVariant = "default",
  replaceCartItem,
  onAdded,
  hideCartLinkOnMobile = false,
}: {
  product: Product;
  variant?: ProductVariant;
  buttonVariant?: "default" | "outline";
  replaceCartItem?: { productId: string; variantId?: string; quantity: number };
  onAdded?: () => void;
  hideCartLinkOnMobile?: boolean;
}) {
  const { addItem, replaceItem, items, getItemMaxStock } = useCart();
  const [added, setAdded] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const selectedVariant = variant ?? getSelectedVariant(product, new URLSearchParams());
  const needsSelection = Boolean(product.variants?.length && !selectedVariant);
  const isAvailable = product.availableForSale && !needsSelection && (selectedVariant?.availableForSale ?? true);
  const cartQuantity = items.find(
    (i) => i.product.id === product.id && i.variantId === selectedVariant?.id
  )?.quantity ?? 0;
  const stockLimit = getItemMaxStock(product.id, selectedVariant?.id);
  const isMaxStockReached = cartQuantity >= stockLimit;
  const canAdd = isAvailable && !isMaxStockReached;

  const handleAdd = (origin?: HTMLElement) => {
    if (!canAdd) return;
    const selectedProduct = selectedVariant
      ? { ...product, price: selectedVariant.price.amount, images: getVariantImages(product, selectedVariant), title: getProductVariantTitle(product.title, selectedVariant) }
      : product;
    if (replaceCartItem) {
      replaceItem(replaceCartItem.productId, replaceCartItem.variantId, selectedProduct, replaceCartItem.quantity, selectedVariant?.id);
      setReplaced(true);
    } else {
      addItem(selectedProduct, 1, selectedVariant?.id);
      setReplaced(false);
      void burstCartConfetti(origin);
    }
    setAdded(true);
    onAdded?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        variant={buttonVariant}
        onClick={(event) => handleAdd(event.currentTarget)}
        disabled={!canAdd}
        aria-label="Sepete Ekle"
        className="h-12 w-full rounded-xl text-sm font-semibold shadow-none gap-2"
      >
        {added ? (
          <>
            <CheckIcon className="h-5 w-5 text-emerald-400" />
            <span>{replaced ? "Sepet güncellendi" : "Sepete Eklendi"}</span>
          </>
        ) : needsSelection ? (
          <span>Seçenekleri seçin</span>
        ) : !isAvailable ? (
          <span>Tükendi</span>
        ) : isMaxStockReached ? (
          <span>Maksimum Stok Sepette ({stockLimit} Adet)</span>
        ) : (
          <>
            <ShoppingBagIcon className="h-5 w-5" />
            <span>Sepete Ekle</span>
          </>
        )}
      </Button>

      {added && (
        <Button
          asChild
          variant="outline"
          size="lg"
          className={`h-12 w-full rounded-xl font-semibold gap-2 border-border animate-fade-in ${hideCartLinkOnMobile ? "hidden md:inline-flex" : ""}`}
        >
          <Link href="/cart">
            <span>Sepeti Görüntüle</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Button>
      )}

      {!isAvailable && !needsSelection && (
        <RestockNotificationDialog
          productId={product.id}
          variantId={selectedVariant?.id}
          productTitle={product.title}
          variantTitle={selectedVariant?.title}
        />
      )}
    </div>
  );
}
