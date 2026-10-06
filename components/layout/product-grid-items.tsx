import Grid from "@/components/grid";
import { GridTileImage } from "@/components/grid/tile";
import { Product } from "@/lib/catalog/types";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorites/favorite-button";

export default function ProductGridItems({
  products,
}: {
  products: Product[];
}) {
  return (
    <>
      {products.map((product) => (
        <Grid.Item key={product.slug} className="animate-fadeIn">
          <div className="relative h-full w-full">
            <Link
              className="relative block h-full w-full"
              href={`/product/${product.slug}`}
              prefetch={true}
            >
              <GridTileImage
                alt={product.title}
                label={{
                  title: product.title,
                  amount: product.price,
                  currencyCode: "TRY",
                }}
                src={product.images[0]}
                fill
                sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            </Link>
            <FavoriteButton
              product={product}
              className="absolute right-3 top-3 z-10 h-11 w-11"
            />
          </div>
        </Grid.Item>
      ))}
    </>
  );
}
