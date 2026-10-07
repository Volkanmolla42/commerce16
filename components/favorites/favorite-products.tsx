"use client";

import { HeartIcon } from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Grid from "@/components/grid";
import { GridTileImage } from "@/components/grid/tile";
import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites-context";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { FavoritesSkeleton } from "./favorites-skeleton";

const EMPTY_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";

export function FavoriteProducts() {
  const { favoriteSlugs, isReady } = useFavorites();
  const products = useQuery(
    api.products.getBySlugs,
    favoriteSlugs.length ? { slugs: favoriteSlugs } : "skip",
  );

  if (!isReady || (favoriteSlugs.length > 0 && products === undefined)) {
    return <FavoritesSkeleton />;
  }

  const favoriteProducts = products ?? [];

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {favoriteProducts.length} ürün kaydedildi
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
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
        <Card className="mx-auto flex max-w-lg flex-col items-center rounded-3xl p-8 text-center shadow-xs sm:p-12">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HeartIcon aria-hidden="true" className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Henüz favori ürününüz yok</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Beğendiğiniz ürünleri kalp simgesine dokunarak burada saklayabilirsiniz.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-2xl font-semibold shadow-md"
          >
            <Link href="/search">Ürünlere göz at</Link>
          </Button>
        </Card>
      )}
    </section>
  );
}
