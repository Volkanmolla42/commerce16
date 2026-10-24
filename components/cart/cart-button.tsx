"use client";

import { routes } from "@/lib/storefront-routes";

import { useCart } from "./cart-context";
import { ShoppingBagIcon, CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRef } from "react";
import { useProductCartFeedback } from "./product-cart-feedback";
import { CountBadge } from "@/components/ui/count-badge";

export function CartButton() {
  const { totalCount } = useCart();
  const target = useRef<HTMLAnchorElement>(null);
  const confirmed = useProductCartFeedback(target);

  return (
    <Link
      ref={target}
      href={routes.cart}
      aria-label="Sepetim"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-white"
    >
      {confirmed ? (
        <CheckIcon aria-hidden="true" className="h-5 w-5 text-emerald-500" />
      ) : (
        <ShoppingBagIcon aria-hidden="true" className="h-5 w-5" />
      )}
      {confirmed ? (
        <span role="status" className="sr-only">
          Ürün sepete eklendi
        </span>
      ) : null}
      <CountBadge count={totalCount} className="absolute -right-1 -top-1 animate-fade-in" />
    </Link>
  );
}
