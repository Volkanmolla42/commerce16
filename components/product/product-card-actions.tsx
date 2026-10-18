"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon } from "@heroicons/react/24/outline";
import { QuickViewDialog } from "./quick-view-dialog";
import { useCart } from "@/components/cart/cart-context";
import { setQuickBuyItem } from "@/components/cart/quick-buy-store";
import { burstCartConfetti } from "@/components/cart/cart-confetti";
import { notifyProductAddedToCart } from "@/components/cart/product-cart-feedback";
import {
  getProductVariantTitle,
} from "@/lib/catalog/variants";
import { getImagesForVariant } from "@/lib/catalog/product-images";
import type { Product, ProductVariant } from "@/lib/catalog/types";

export function ProductCardActions({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const variants = product.variants ?? [];
  const hasMultipleVariants = variants.length > 1;
  const singleVariant = variants.length === 1 ? variants[0] : undefined;

  const resolveConfiguredProduct = (variant?: ProductVariant) => {
    const itemVariant = variant ?? singleVariant;
    if (!itemVariant) return { configuredProduct: product, itemVariant: undefined };

    const variantImages = getImagesForVariant(product.images, itemVariant.selectedOptions);
    return {
      configuredProduct: {
        ...product,
        price: typeof itemVariant.price === "string" ? itemVariant.price : itemVariant.price.amount,
        images: variantImages.length > 0 ? variantImages : product.images,
        title: getProductVariantTitle(product.title, itemVariant),
      },
      itemVariant,
    };
  };

  const handleAddToCart = (event: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => {
    event.preventDefault();
    event.stopPropagation();

    if (hasMultipleVariants && !variant) {
      setIsQuickViewOpen(true);
      return;
    }

    const { configuredProduct, itemVariant } = resolveConfiguredProduct(variant);
    addItem(configuredProduct, 1, itemVariant?.id);
    void burstCartConfetti(event.currentTarget);
    notifyProductAddedToCart();
  };

  const handleQuickBuy = (event: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => {
    event.preventDefault();
    event.stopPropagation();

    if (hasMultipleVariants && !variant) {
      setIsQuickViewOpen(true);
      return;
    }

    const { configuredProduct, itemVariant } = resolveConfiguredProduct(variant);
    setQuickBuyItem({
      product: configuredProduct,
      quantity: 1,
      variantId: itemVariant?.id,
    });
    router.push("/checkout?mode=quick-buy");
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] aspect-[4/5] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsQuickViewOpen(true)}
          aria-haspopup="dialog"
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-10 translate-y-full items-center justify-center gap-1.5 bg-background/90 text-xs font-medium text-foreground backdrop-blur-sm transition-transform duration-200 ease-out hover:bg-background focus-visible:translate-y-0 group-hover:translate-y-0 motion-reduce:transition-none [@media(hover:none)]:translate-y-0"
        >
          <EyeIcon className="size-3.5" aria-hidden="true" />
          Hızlı Bakış
        </button>
      </div>

      <QuickViewDialog
        product={product}
        open={isQuickViewOpen}
        onOpenChange={setIsQuickViewOpen}
        onAdd={(event, variant) => {
          handleAddToCart(event, variant);
          setIsQuickViewOpen(false);
        }}
        onBuy={(event, variant) => {
          handleQuickBuy(event, variant);
          setIsQuickViewOpen(false);
        }}
      />
    </>
  );
}
