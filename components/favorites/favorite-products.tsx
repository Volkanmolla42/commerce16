"use client";

import { HeartIcon } from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Grid from "@/components/grid";
import { GridTileImage } from "@/components/grid/tile";
import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites-context";
import Link from "next/link";

const EMPTY_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";

export function FavoriteProducts() {
  const { favoriteSlugs, isReady } = useFavorites();
  const products = useQuery(
    api.products.getBySlugs,
    favoriteSlugs.length ? { slugs: favoriteSlugs } : "skip",
  );

  if (!isReady || (favoriteSlugs.length > 0 && products === undefined)) {
    return (
      <div aria-busy="true" className="mx-auto grid max-w-(--breakpoint-2xl) grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }

  const favoriteProducts = products ?? [];

  return (
    <section className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {favoriteProducts.length} ürün kaydedildi
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Favorilerim
          </h1>
        </div>
      </header>

      {favoriteProducts.length ? (
        <Grid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {favoriteProducts.map((product) => (
            <Grid.Item key={product.slug} className="relative animate-fadeIn">
              <Link
                className="relative block h-full w-full"
                href={`/product/${product.slug}`}
                prefetch={true}
              >
                <GridTileImage
                  alt={product.title}
                  label={{ title: product.title, amount: product.price, currencyCode: "TRY" }}
                  src={product.images[0] || EMPTY_PRODUCT_IMAGE}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                />
              </Link>
              <FavoriteButton
                product={product}
                className="absolute right-3 top-3 z-10 h-11 w-11"
              />
            </Grid.Item>
          ))}
        </Grid>
      ) : (
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-neutral-200 bg-white px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <HeartIcon aria-hidden="true" className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Henüz favori ürününüz yok</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Beğendiğiniz ürünleri kalp simgesine dokunarak burada saklayabilirsiniz.
          </p>
          <Link
            href="/search"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:focus-visible:outline-white"
          >
            Ürünleri keşfet
          </Link>
        </div>
      )}
    </section>
  );
}
