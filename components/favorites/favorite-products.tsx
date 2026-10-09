"use client";

import { HeartIcon } from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { useFavorites } from "./favorites-context";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { formatProduct } from "@/lib/catalog/format-product";
import { FavoritesSkeleton } from "./favorites-skeleton";

export function FavoriteProducts() {
  const { favoriteSlugs, isReady } = useFavorites();
  const products = useQuery(
    api.products.getBySlugs,
    favoriteSlugs.length ? { slugs: favoriteSlugs } : "skip",
  );

  if (!isReady || (favoriteSlugs.length > 0 && products === undefined)) {
    return <FavoritesSkeleton />;
  }

  const favoriteProducts = (products ?? []).map(formatProduct);
  return (
    <section className="space-y-6">
      {favoriteProducts.length ? (
        <Grid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <ProductGridItems
            products={favoriteProducts}
            imageSizes="(min-width: 1280px) 18vw, (min-width: 1024px) 20vw, (min-width: 640px) 30vw, 50vw"
            cardLayout="stacked"
            imageFit="cover"
          />
        </Grid>
      ) : (
        <Card className="rounded-3xl border-border bg-card p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HeartIcon aria-hidden="true" className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">Henüz favori ürününüz yok</h2>
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
