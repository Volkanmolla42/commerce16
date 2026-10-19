"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Price from "@/components/price";
import { useCart } from "@/components/cart/cart-context";
import { ProductBadges } from "./product-badges";
import { Gallery } from "./gallery";
import { getProductPriceRange, isVariantSellable } from "@/lib/catalog/variants";
import type { Product, ProductVariant } from "@/lib/catalog/types";

type QuickViewDialogProps = {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (event: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => void;
  onBuy: (event: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => void;
};

export function QuickViewDialog({ product, open, onOpenChange, onAdd, onBuy }: QuickViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,48rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl [&>button]:bg-background/80 [&>button]:backdrop-blur-sm">
        <QuickViewContent
          product={product}
          onOpenChange={onOpenChange}
          onAdd={onAdd}
          onBuy={onBuy}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuickViewContent({
  product,
  onOpenChange,
  onAdd,
  onBuy,
}: Omit<QuickViewDialogProps, "open">) {
  const { items, getItemMaxStock } = useCart();
  const variants = product.variants ?? [];
  const options = product.options ?? [];
  const initialVariant = variants.find(isVariantSellable) ?? variants[0];
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialVariant?.selectedOptions.map(({ name, value }) => [name, value]) ?? [])
  );
  const activeVariant = variants.find((variant) =>
    variant.selectedOptions.every((option) => selectedOptions[option.name] === option.value)
  );
  const priceRange = getProductPriceRange(product);
  const displayPrice = activeVariant?.price ?? priceRange.min;
  const maxPrice = activeVariant ? undefined : priceRange.max;
  const isAvailable = product.availableForSale && Boolean(activeVariant && isVariantSellable(activeVariant));
  const cartQuantity = items.find(
    (item) => item.product.id === product.id && item.variantId === activeVariant?.id
  )?.quantity ?? 0;
  const stockLimit = activeVariant ? getItemMaxStock(product.id, activeVariant.id) : 0;
  const isMaxStockReached = Boolean(activeVariant) && cartQuantity >= stockLimit;

  return (
    <div className="grid sm:grid-cols-2">
      <div className="bg-muted/30 p-4 sm:p-5">
        <Gallery
          product={product}
          selectedVariant={activeVariant}
          onSelectVariant={(variant) => {
            setSelectedOptions(() => {
              const next: Record<string, string> = {};
              for (const opt of variant.selectedOptions) {
                next[opt.name] = opt.value;
              }
              return next;
            });
          }}
        />
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6 sm:pt-12">
        <DialogHeader className="space-y-2 text-left">
          <ProductBadges
            variants={variants}
            _creationTime={product._creationTime}
            soldCount={product.soldCount}
            selectedVariantId={activeVariant?.id}
          />
          <DialogTitle className="line-clamp-2 text-lg font-semibold leading-snug sm:text-xl">
            {product.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ürün galerisi, fiyatı ve seçenekleri
          </DialogDescription>
          <Price
            amount={displayPrice}
            maxAmount={maxPrice}
            compareAtAmount={activeVariant?.compareAtPrice}
            className="text-xl font-semibold tracking-tight text-foreground"
          />
        </DialogHeader>

        {options.length > 0 ? (
          <div className="space-y-4">
            {options.map((option) => (
              <div key={option.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{option.name}</span>
                  <span className="text-muted-foreground">
                    {selectedOptions[option.name] ?? "Seçiniz"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
                  {option.values.map((value) => {
                    const isSelected = selectedOptions[option.name] === value;
                    const potentialOptions = { ...selectedOptions, [option.name]: value };
                    const isOptionSellable = variants.some((variant) =>
                      isVariantSellable(variant) &&
                      variant.selectedOptions.every((selected) => {
                        const chosen = potentialOptions[selected.name];
                        return !chosen || chosen === selected.value;
                      })
                    );

                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setSelectedOptions((current) => ({ ...current, [option.name]: value }));
                        }}
                        disabled={!isOptionSellable}
                        className={`relative inline-flex min-h-9 min-w-10 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : isOptionSellable
                              ? "border border-border/80 bg-background text-foreground hover:border-primary/40 hover:bg-muted"
                              : "border border-dashed border-border/60 bg-muted/40 text-muted-foreground/50 line-through cursor-not-allowed"
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-auto space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={(event) => onAdd(event, activeVariant)}
              disabled={!isAvailable || isMaxStockReached}
              className="h-11 rounded-xl text-xs font-semibold gap-1.5"
            >
              {!isAvailable ? (
                <span>Tükendi</span>
              ) : isMaxStockReached ? (
                <span>Dolu</span>
              ) : (
                <>
                  <ShoppingBagIcon className="size-4" />
                  <span>Sepete Ekle</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={(event) => onBuy(event, activeVariant)}
              disabled={!isAvailable}
              className="h-11 rounded-xl text-xs font-semibold gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              <BoltIcon className="size-4 fill-current" />
              <span>Hemen Al</span>
              <ArrowRightIcon className="size-3.5 ml-0.5" />
            </Button>
          </div>
          <Link
            href={`/product/${product.slug}`}
            onClick={() => onOpenChange(false)}
            className="block text-center text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Tüm ürün detaylarını incele
          </Link>
        </div>
      </div>
    </div>
  );
}
