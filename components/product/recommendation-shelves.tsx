"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { useCart } from "@/components/cart/cart-context";
import type { CartItem } from "@/components/cart/cart-context";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/format-money";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Product } from "@/lib/catalog/types";
import {
  getRecentProductSlugs,
  rankProductRecommendations,
  rankUpsellRecommendations,
  RECENT_PRODUCTS_EVENT,
  recordRecentProduct,
} from "@/lib/catalog/recommendations";
import { getProductPriceRange, getSelectedVariant } from "@/lib/catalog/variants";

export function ProductViewTracker({ slug }: { slug: string }) {
  useEffect(() => recordRecentProduct(slug), [slug]);
  return null;
}

function Shelf({ title, products, showCartActions = false, upsellSources, layout = "scroll" }: {
  title: string;
  products: Product[];
  showCartActions?: boolean;
  upsellSources?: Map<string, CartItem>;
  layout?: "scroll" | "centered";
}) {
  const { addItem, replaceItem } = useCart();
  if (products.length === 0) return null;
  return (
    <section className="mt-12 border-t border-neutral-200 py-8 dark:border-neutral-800" aria-label={title}>
      <h2 className={`${layout === "centered" ? "mx-auto max-w-5xl" : ""} mb-5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white`}>{title}</h2>
      {showCartActions ? (
        <ul className="grid grid-flow-col auto-cols-[12rem] gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] sm:auto-cols-[14rem]">
          {products.map((product) => {
            const defaultVariant = getSelectedVariant(product, new URLSearchParams());
            const needsVariant = Boolean(product.variants?.length && !defaultVariant);
            const upsellSource = upsellSources?.get(product.id);
            const replacementParams = upsellSource
              ? new URLSearchParams({ cartReplaceProductId: upsellSource.product.id })
              : null;
            if (replacementParams && upsellSource?.variantId) {
              replacementParams.set("cartReplaceVariantId", upsellSource.variantId);
            }
            const productHref = replacementParams
              ? `/product/${product.slug}?${replacementParams.toString()}`
              : `/product/${product.slug}`;
            const priceRange = getProductPriceRange(product);
            return (
              <li key={product.id} className="min-w-0">
                <article className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-square bg-muted/30">
                    <Link href={productHref} aria-label={`${product.title} ürününü incele`} className="absolute inset-0">
                      {product.images[0] && (
                        <Image src={product.images[0]} alt={product.title} fill sizes="(min-width: 768px) 224px, 192px" className="object-contain p-3" />
                      )}
                    </Link>
                    <FavoriteButton product={product} className="absolute right-3 top-3 z-10" />
                  </div>
                  <div className="space-y-3 p-3">
                    <Link href={productHref} className="line-clamp-2 min-h-10 text-sm font-semibold text-foreground hover:underline">
                      {product.title}
                    </Link>
                    <p className="text-sm font-bold text-foreground">{formatMoney(priceRange.min)}{Number(priceRange.min) !== Number(priceRange.max) ? ` ile ${formatMoney(priceRange.max)}` : ""}</p>
                    {needsVariant ? (
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link href={productHref}>{upsellSource ? "Seçeneği belirle" : "Seçenekleri seç"}</Link>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" className="w-full" onClick={() => upsellSource
                        ? replaceItem(upsellSource.product.id, upsellSource.variantId, product, upsellSource.quantity)
                        : addItem(product, 1, defaultVariant?.id)}>
                        {upsellSource ? "Sepettekiyle değiştir" : "Sepete ekle"}
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <Grid className={layout === "centered"
          ? `mx-auto max-w-5xl ${products.length === 1 ? "grid-cols-1" : products.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-3 sm:gap-4`
          : "grid-flow-col auto-cols-[12rem] overflow-x-auto pb-3 [scrollbar-width:thin] sm:auto-cols-[14rem]"}>
          <ProductGridItems
            products={products}
            imageSizes={layout === "centered" ? "(min-width: 1024px) 320px, (min-width: 640px) 224px, 50vw" : "(min-width: 640px) 224px, 192px"}
            prioritizeFirst={layout === "centered"}
            cardLayout="stacked"
            imageFit={layout === "centered" ? "cover" : "contain"}
          />
        </Grid>
      )}
    </section>
  );
}

export function PersonalizedRecommendationShelf({ products }: { products: Product[] }) {
  const { items } = useCart();
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setRecentSlugs(getRecentProductSlugs());
    update();
    window.addEventListener(RECENT_PRODUCTS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(RECENT_PRODUCTS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const recommendations = useMemo(() => {
    const catalogBySlug = new Map(products.map((product) => [product.slug, product]));
    const sources = [
      ...items.map(({ product }) => ({ product, weight: 2.5 })),
      ...recentSlugs.flatMap((slug, index) => {
        const product = catalogBySlug.get(slug);
        return product ? [{ product, weight: Math.max(0.75, 1.8 - index * 0.06) }] : [];
      }),
    ];
    const excluded = [...new Set([...items.map(({ product }) => product.slug), ...recentSlugs.slice(0, 2)])];
    const personalized = rankProductRecommendations(products, sources, excluded, 8);
    if (personalized.length > 0) return personalized;
    return products
      .filter((product) => product.availableForSale)
      .toSorted((a, b) => a.title.localeCompare(b.title, "tr"))
      .slice(0, 8);
  }, [items, products, recentSlugs]);

  const title = items.length > 0
    ? "Sepetiniz için seçtiklerimiz"
    : recentSlugs.length > 0
      ? "Sizin için seçtiklerimiz"
      : "Öne çıkan ürünler";

  return <Shelf title={title} products={recommendations.slice(0, 3)} layout="centered" />;
}

export function BoughtTogetherShelf({
  products,
  sourceProducts = [],
  sourceProductIds,
  useCartContext = false,
  fallbackTitle = "Bu ürünle uyumlu seçimler",
}: {
  products: Product[];
  sourceProducts?: Product[];
  sourceProductIds?: string[];
  useCartContext?: boolean;
  fallbackTitle?: string;
}) {
  const { items } = useCart();
  const cartProducts = useCartContext ? items.map((item) => item.product) : [];
  const sources = useCartContext
    ? sourceProducts.length > 0 ? sourceProducts : cartProducts
    : sourceProducts;
  const sourceIds = [...new Set([
    ...(useCartContext ? cartProducts.map((product) => product.id) : sourceProductIds ?? []),
  ])].slice(0, 10);
  const purchasePairs = useQuery(
    api.orders.getFrequentlyBoughtTogether,
    sourceIds.length > 0 ? { productIds: sourceIds } : "skip",
  );

  const recommendations = useMemo(() => {
    const sourceSlugSet = new Set(sources.map((product) => product.slug));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const purchasedTogether = (purchasePairs ?? [])
      .map(({ productId }) => productsById.get(productId))
      .filter((product): product is Product => Boolean(product?.availableForSale && !sourceSlugSet.has(product.slug)));
    if (purchasedTogether.length > 0) return purchasedTogether.slice(0, 8);
    return rankProductRecommendations(
      products,
      sources.map((product) => ({ product, weight: 1.5 })),
      [...sourceSlugSet],
      8,
    );
  }, [products, purchasePairs, sources]);

  const hasPurchaseData = Boolean(purchasePairs?.some(({ productId }) => products.some((product) => product.id === productId)));
  return (
    <Shelf
      title={hasPurchaseData ? "Bunu alanlar bunları da aldı" : useCartContext ? "Sepetinizi tamamlayın" : fallbackTitle}
      products={recommendations}
      showCartActions={useCartContext}
    />
  );
}

function mapRecommendationProduct(product: Doc<"products">): Product {
  return {
    id: product._id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    sku: product.sku,
    availableForSale: product.availableForSale,
    brand: product.brand,
    material: product.material,
    categorySlug: product.categorySlug,
    stockQuantity: product.stockQuantity,
    images: product.images.slice(0, 1),
    options: product.options,
    variants: product.variants?.map(({ price, ...variant }) => ({
      ...variant,
      ...(price ? { price: { amount: price, currencyCode: "TRY" } } : {}),
    })),
    updatedAt: product.updatedAt || new Date(product._creationTime).toISOString(),
  };
}

export function CartRecommendationShelf() {
  const { items } = useCart();
  const data = useQuery(api.products.list, items.length > 0 ? { limit: 100 } : "skip");
  const products: Product[] = (data ?? []).map(mapRecommendationProduct);
  const cartProductSlugs = [...new Set(items.map((item) => item.product.slug))];
  const upsellSources = new Map<string, CartItem>();
  for (const sourceItem of items) {
    const candidates = rankUpsellRecommendations(products, sourceItem.product, cartProductSlugs, 8);
    for (const candidate of candidates) {
      if (upsellSources.has(candidate.id)) continue;
      const availableVariants = (candidate.variants ?? []).filter((variant) => variant.availableForSale);
      const sufficientStock = availableVariants.length > 0
        ? availableVariants.some((variant) => variant.stockQuantity == null || variant.stockQuantity >= sourceItem.quantity)
        : candidate.stockQuantity == null || candidate.stockQuantity >= sourceItem.quantity;
      if (sufficientStock) upsellSources.set(candidate.id, sourceItem);
      if (upsellSources.size >= 8) break;
    }
    if (upsellSources.size >= 8) break;
  }
  const upsellProducts = [...upsellSources.keys()].flatMap((id) => {
    const product = products.find((candidate) => candidate.id === id);
    return product ? [product] : [];
  });

  if (!items.length || !data) return null;
  return (
    <>
      <BoughtTogetherShelf products={products} useCartContext fallbackTitle="Sepetinize uygun öneriler" />
      <Shelf title="Daha üst segmente geçin" products={upsellProducts} showCartActions upsellSources={upsellSources} />
    </>
  );
}
