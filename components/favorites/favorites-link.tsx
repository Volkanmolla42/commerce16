"use client";

import { routes } from "@/lib/storefront-routes";

import { HeartIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useFavorites } from "./favorites-context";
import { CountBadge } from "@/components/ui/count-badge";

export function FavoritesLink() {
  const { favoriteSlugs, isReady } = useFavorites();
  const count = favoriteSlugs.length;

  return (
    <Link
      href={routes.accountFavorites}
      aria-label={count ? `Favorilerim, ${count} ürün` : "Favorilerim"}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-rose-600 sm:w-auto sm:gap-2 sm:px-3 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-rose-400"
    >
      <HeartIcon aria-hidden="true" className="h-5 w-5" />
      <span className="hidden text-xs font-medium sm:inline">Favorilerim</span>
      {isReady ? <CountBadge count={count} className="absolute -right-1 -top-1" /> : null}
    </Link>
  );
}
