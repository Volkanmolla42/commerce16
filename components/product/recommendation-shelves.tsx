"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Grid from "@/components/grid";
import { ProductCard, productShelfGridClassName } from "@/components/product/product-card";
import { useCart } from "@/components/cart/cart-context";
import type { CartItem } from "@/components/cart/cart-context";
import { Button } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { Product } from "@/lib/catalog/types";
import {
  getRecentProductSlugs,
  rankProductRecommendations,
  rankUpsellRecommendations,
  RECENT_PRODUCTS_EVENT,
  recordRecentProduct,
} from "@/lib/catalog/recommendations";
import { getProductVariantTitle, getSelectedVariant } from "@/lib/catalog/variants";
import { getProductImages, getVariantImages } from "@/lib/catalog/product-images";
import { burstCartConfetti } from "@/components/cart/cart-confetti";
import { trackPixelViewContent } from "@/lib/analytics/meta-pixel";

export function ProductViewTracker({
  slug,
  product,
}: {
  slug: string;
  product?: { id: string; title: string; price?: string };
}) {
  useEffect(() => {
    recordRecentProduct(slug);
    if (product) {
      const priceVal = product.price ? Number(product.price) : undefined;
      trackPixelViewContent({
        content_id: product.id,
        content_name: product.title,
        value: Number.isFinite(priceVal) ? priceVal : undefined,
        currency: "TRY",
      });
    }
  }, [slug, product?.id, product?.title, product?.price]);
  return null;
}

function ShelfCartAction({
  productHref,
  needsVariant,
  upsellSource,
  onAdd,
}: {
  productHref: string;
  needsVariant: boolean;
  upsellSource?: CartItem;
  onAdd: (origin: HTMLElement) => void;
}) {
  if (needsVariant) {
    return (
      <Button asChild size="sm" variant="outline" className="w-full">
        <Link href={productHref}>{upsellSource ? "Seçeneği belirle" : "Seçenekleri seç"}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" className="w-full" onClick={(event) => onAdd(event.currentTarget)}>
      {upsellSource ? "Sepettekiyle değiştir" : "Sepete ekle"}
    </Button>
  );
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
      <Grid className={layout === "centered"
        ? `mx-auto ${products.length === 1 ? "max-w-xs grid-cols-1" : products.length === 2 ? "max-w-2xl grid-cols-2" : "max-w-5xl grid-cols-2 sm:grid-cols-3"} gap-3 sm:gap-4`
        : productShelfGridClassName}>
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
          const selectedProduct = defaultVariant
            ? { ...product, price: defaultVariant.price.amount, title: getProductVariantTitle(product.title, defaultVariant), images: getVariantImages(product, defaultVariant) }
            : product;
          const handleAdd = (origin: HTMLElement) => {
            if (upsellSource) {
              replaceItem(upsellSource.product.id, upsellSource.variantId, selectedProduct, upsellSource.quantity, defaultVariant?.id);
              return;
            }
            addItem(selectedProduct, 1, defaultVariant?.id);
            void burstCartConfetti(origin);
          };
          return (
            <Grid.Item key={product.id} square={false}>
              <ProductCard
                product={product}
                href={productHref}
                imageSizes={layout === "centered" ? "(min-width: 1024px) 320px, (min-width: 640px) 224px, 50vw" : "(min-width: 1024px) 256px, (min-width: 640px) 224px, 72vw"}
                priority={layout === "centered"}
                action={showCartActions ? (
                  <ShelfCartAction
                    productHref={productHref}
                    needsVariant={needsVariant}
                    upsellSource={upsellSource}
                    onAdd={handleAdd}
                  />
                ) : undefined}
              />
            </Grid.Item>
          );
        })}
      </Grid>
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
  const recommendations = personalized.length > 0
    ? personalized
    : products
        .filter((product) => product.availableForSale)
        .toSorted((a, b) => a.title.localeCompare(b.title, "tr"))
        .slice(0, 8);

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

  const sourceSlugSet = new Set(sources.map((product) => product.slug));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const purchasedTogether = (purchasePairs ?? [])
    .map(({ productId }) => productsById.get(productId))
    .filter((product): product is Product => Boolean(product?.availableForSale && !sourceSlugSet.has(product.slug)));
  const recommendations = purchasedTogether.length > 0
    ? purchasedTogether.slice(0, 8)
    : rankProductRecommendations(
        products,
        sources.map((product) => ({ product, weight: 1.5 })),
        [...sourceSlugSet],
        8,
      );

  const hasPurchaseData = Boolean(purchasePairs?.some(({ productId }) => products.some((product) => product.id === productId)));
  return (
    <Shelf
      title={hasPurchaseData ? "Bunu alanlar bunları da aldı" : useCartContext ? "Sepetinizi tamamlayın" : fallbackTitle}
      products={recommendations}
      showCartActions={useCartContext}
    />
  );
}

function mapRecommendationProduct(product: NonNullable<ReturnType<typeof useQuery<typeof api.products.list>>>[number]): Product {
  return {
    id: product._id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    availableForSale: product.availableForSale,
    categorySlug: product.categorySlug,
    images: getProductImages(product).slice(0, 1),
    options: product.options,
    variants: product.variants.map(({ price, ...variant }) => ({
      ...variant,
      price: { amount: price, currencyCode: "TRY" },
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
      if (candidate.variants?.length ? availableVariants.length > 0 : candidate.availableForSale) {
        upsellSources.set(candidate.id, sourceItem);
      }
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
