"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBagIcon,
  BoltIcon,
  CheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/components/cart/cart-context";
import { setQuickBuyItem } from "@/components/cart/quick-buy-store";
import { burstCartConfetti } from "@/components/cart/cart-confetti";
import { notifyProductAddedToCart } from "@/components/cart/product-cart-feedback";
import {
  getProductVariantTitle,
  isVariantSellable,
  getProductPriceRange,
} from "@/lib/catalog/variants";
import { getProductImages, getVariantImages } from "@/lib/catalog/product-images";
import Price from "@/components/price";
import type { Product, ProductVariant } from "@/lib/catalog/types";

export function ProductCardActions({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, getItemMaxStock, items } = useCart();

  const [isAdded, setIsAdded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const variants = product.variants ?? [];
  const options = product.options ?? [];
  const hasMultipleVariants = variants.length > 1;

  // İlk satılabilir varyantı veya ilk varyantı varsayılan olarak belirle
  const initialVariant = variants.find(isVariantSellable) ?? variants[0];
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialVariant?.selectedOptions?.map((opt) => [opt.name, opt.value]) ?? [])
  );

  // Seçili seçeneklerle eşleşen aktif varyantı bul
  const activeVariant: ProductVariant | undefined = hasMultipleVariants
    ? variants.find((variant) =>
        variant.selectedOptions.every(
          (opt) => selectedOptions[opt.name] === opt.value
        )
      ) ?? initialVariant
    : variants[0];

  const targetVariant = hasMultipleVariants ? activeVariant : (variants[0] ?? undefined);
  const isAvailable = product.availableForSale && (targetVariant ? isVariantSellable(targetVariant) : true);

  const cartQuantity = items.find(
    (i) => i.product.id === product.id && i.variantId === targetVariant?.id
  )?.quantity ?? 0;
  const stockLimit = getItemMaxStock(product.id, targetVariant?.id);
  const isMaxStockReached = cartQuantity >= stockLimit;

  const resolveConfiguredProduct = (variant?: ProductVariant) => {
    const itemVariant = variant ?? targetVariant;
    if (!itemVariant) return { configuredProduct: product, itemVariant: undefined };

    const variantImages = getVariantImages(product, itemVariant);
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

  // 1. Doğrudan sepete ekle
  const handleAddToCart = (e: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasMultipleVariants && !variant) {
      setIsModalOpen(true);
      return;
    }

    const { configuredProduct, itemVariant } = resolveConfiguredProduct(variant);
    addItem(configuredProduct, 1, itemVariant?.id);
    void burstCartConfetti(e.currentTarget);
    notifyProductAddedToCart();

    setIsAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setIsAdded(false), 2200);

    if (isModalOpen) {
      setIsModalOpen(false);
    }
  };

  // 2. Doğrudan Hemen Satın Al
  const handleQuickBuy = (e: React.MouseEvent<HTMLElement>, variant?: ProductVariant) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasMultipleVariants && !variant) {
      setIsModalOpen(true);
      return;
    }

    const { configuredProduct, itemVariant } = resolveConfiguredProduct(variant);
    setQuickBuyItem({
      product: configuredProduct,
      quantity: 1,
      variantId: itemVariant?.id,
    });

    setIsNavigating(true);
    router.push("/checkout?mode=quick-buy");
  };

  // Kart üzerindeki butonlar
  if (!product.availableForSale) {
    return (
      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <Button
          type="button"
          disabled
          variant="outline"
          size="sm"
          className="h-8 w-full rounded-xl text-xs font-medium opacity-60 cursor-not-allowed"
        >
          Tükendi
        </Button>
      </div>
    );
  }

  const thumbImage = (targetVariant ? getVariantImages(product, targetVariant)[0] : undefined) ?? getProductImages(product)[0];
  const priceRange = getProductPriceRange(product);
  const displayPrice = targetVariant
    ? (typeof targetVariant.price === "string" ? targetVariant.price : targetVariant.price.amount)
    : priceRange.min;

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5 sm:gap-2 sm:px-3 sm:pb-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => handleAddToCart(e)}
          disabled={!isAvailable || isMaxStockReached}
          className="h-8 sm:h-9 w-full rounded-xl px-1.5 sm:px-3 text-xs font-medium border-border/80 hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all"
          title="Sepete Ekle"
          aria-label="Sepete Ekle"
        >
          {isAdded ? (
            <>
              <CheckIcon className="size-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] sm:text-xs text-emerald-600 font-semibold truncate">Eklendi</span>
            </>
          ) : isMaxStockReached ? (
            <span className="text-[11px] sm:text-xs truncate">Dolu</span>
          ) : (
            <>
              <ShoppingBagIcon className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              <span className="truncate">Ekle</span>
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={(e) => handleQuickBuy(e)}
          disabled={!isAvailable || isNavigating}
          className="h-8 sm:h-9 w-full rounded-xl px-1.5 sm:px-3 text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 active:scale-95 transition-all shadow-xs"
          title="Hemen Satın Al"
          aria-label="Hemen Satın Al"
        >
          {isNavigating ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <BoltIcon className="size-3.5 shrink-0 fill-current" />
              <span className="truncate">Hemen Al</span>
            </>
          )}
        </Button>
      </div>

      {/* Birden çok varyantı olan ürünler için Hızlı Seçim Modalı */}
      {hasMultipleVariants ? (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent
            className="sm:max-w-md p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
                Seçenekleri Belirleyin
              </DialogTitle>
            </DialogHeader>

            {/* Ürün Bilgi Kartı */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3">
              {thumbImage?.url ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={thumbImage.url}
                    alt={product.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-medium text-foreground">
                  {product.title}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <Price
                    amount={displayPrice}
                    currencyCode="TRY"
                    className="text-sm font-semibold text-foreground"
                  />
                  {targetVariant?.title ? (
                    <span className="text-[11px] text-muted-foreground truncate">
                      ({targetVariant.title})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Seçenek Listeleri (Beden, Renk vb.) */}
            <div className="space-y-4 py-2">
              {options.map((option) => (
                <div key={option.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{option.name}</span>
                    <span className="text-muted-foreground">
                      {selectedOptions[option.name] ?? "Seçiniz"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((val) => {
                      const isSelected = selectedOptions[option.name] === val;

                      // Bu seçenek seçilirse geçerli bir satılabilir varyant var mı?
                      const potentialOptions = { ...selectedOptions, [option.name]: val };
                      const matchedVariant = variants.find((v) =>
                        v.selectedOptions.every((opt) => potentialOptions[opt.name] === opt.value)
                      );
                      const isOptionSellable = matchedVariant ? isVariantSellable(matchedVariant) : true;

                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setSelectedOptions((prev) => ({ ...prev, [option.name]: val }));
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
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Aksiyon Butonları */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={(e) => handleAddToCart(e, targetVariant)}
                disabled={!isAvailable || isMaxStockReached}
                className="h-11 rounded-xl text-xs font-semibold gap-1.5"
              >
                {isAdded ? (
                  <>
                    <CheckIcon className="size-4 text-emerald-500" />
                    <span>Eklendi</span>
                  </>
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
                onClick={(e) => handleQuickBuy(e, targetVariant)}
                disabled={!isAvailable || isNavigating}
                className="h-11 rounded-xl text-xs font-semibold gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                {isNavigating ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <BoltIcon className="size-4 fill-current" />
                    <span>Hemen Al</span>
                    <ArrowRightIcon className="size-3.5 ml-0.5" />
                  </>
                )}
              </Button>
            </div>

            {/* Ürün Detayına Git Bağlantısı */}
            <div className="text-center pt-1">
              <Link
                href={`/product/${product.slug}`}
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                Tüm ürün detaylarını incele
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
