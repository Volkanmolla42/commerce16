"use client";

import { useCart } from "./cart-context";
import { Product } from "@/lib/catalog/types";
import { useState } from "react";
import { ShoppingBag01Icon, Tick01Icon, ArrowRight01Icon } from "hugeicons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const isAvailable = product.availableForSale;

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
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
