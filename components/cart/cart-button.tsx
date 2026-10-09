"use client";

import { useCart } from "./cart-context";
import { ShoppingBag01Icon } from "hugeicons-react";
import Link from "next/link";

export function CartButton() {
  const { totalCount } = useCart();

  return (
    <Link
      href="/cart"
      aria-label="Alışveriş Sepeti"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-white"
    >
      <ShoppingBag01Icon className="h-5 w-5" />
      {totalCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white animate-scaleIn">
          {totalCount}
        </span>
      )}
    </Link>
  );
}
