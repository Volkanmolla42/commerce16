"use client";

import { useCart } from "./cart-context";
import type { Product, ProductVariant } from "@/lib/catalog/types";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag01Icon, Tick01Icon, ArrowRight01Icon } from "hugeicons-react";
import Link from "next/link";
import { Button } from "@/components/ui";

export function AddToCart({
  product,
  variant,
  buttonVariant = "default",
}: {
  product: Product;
  variant?: ProductVariant;
  buttonVariant?: "default" | "outline";
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const needsSelection = Boolean(product.variants?.length && !variant);
  const isAvailable = product.availableForSale && !needsSelection && (variant?.availableForSale ?? true);

  const handleAdd = () => {
    if (!isAvailable) return;
    addItem(variant ? { ...product, price: variant.price.amount, title: `${product.title} — ${variant.title}` } : product, 1, variant?.id);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        variant={buttonVariant}
        onClick={handleAdd}
        disabled={!isAvailable}
        aria-label="Sepete Ekle"
        className="h-14 w-full rounded-full text-base font-semibold shadow-md gap-2"
      >
        {added ? (
          <>
            <Tick01Icon className="h-5 w-5 text-emerald-400" />
            <span>Sepete Eklendi</span>
          </>
        ) : needsSelection ? (
          <span>Seçenekleri seç</span>
        ) : !isAvailable ? (
          <span>Tükendi</span>
        ) : (
          <>
            <ShoppingBag01Icon className="h-5 w-5" />
            <span>Sepete Ekle</span>
          </>
        )}
      </Button>

      {added && (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 w-full rounded-full font-semibold gap-2 border-border animate-in fade-in duration-200"
        >
          <Link href="/cart">
            <span>Sepeti Görüntüle</span>
            <ArrowRight01Icon className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
