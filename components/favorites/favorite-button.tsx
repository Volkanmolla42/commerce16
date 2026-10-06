"use client";

import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";
import { useOptimistic, useState, useTransition, type MouseEvent } from "react";
import { useFavorites } from "./favorites-context";

type FavoriteTarget = Pick<Product, "slug" | "title">;

export function FavoriteButton({
  product,
  className,
  showLabel = false,
}: {
  product: FavoriteTarget;
  className?: string;
  showLabel?: boolean;
}) {
  const { isFavorite, isReady, toggleFavorite } = useFavorites();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const selected = isFavorite(product.slug);
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isReady || isPending) return;

    setError("");
    startTransition(async () => {
      setOptimisticSelected(!optimisticSelected);
      try {
        await toggleFavorite(product.slug);
      } catch {
        setError("Favori kaydedilemedi. Lütfen tekrar deneyin.");
        setOptimisticSelected(optimisticSelected);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Favori: ${product.title}`}
        aria-pressed={optimisticSelected}
        disabled={!isReady || isPending}
        onClick={handleClick}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur-sm transition hover:scale-105 hover:text-rose-600 active:scale-95 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:text-rose-400 dark:focus-visible:outline-white",
          optimisticSelected && "text-rose-600 dark:text-rose-400",
          showLabel && "px-4 text-sm font-medium",
          className,
        )}
      >
        {optimisticSelected ? (
          <HeartSolidIcon aria-hidden="true" className="h-5 w-5" />
        ) : (
          <HeartOutlineIcon aria-hidden="true" className="h-5 w-5" />
        )}
        {showLabel ? <span>{optimisticSelected ? "Favorilerimde" : "Favorilere ekle"}</span> : null}
      </button>
      {error ? <span role="status" className="sr-only">{error}</span> : null}
    </>
  );
}
