"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Product } from "@/lib/catalog/types";
import { setCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { useCart } from "@/components/cart/cart-context";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Badge,
} from "@/components/ui";
import { formatMoney } from "@/lib/format-money";
import { getProductPriceRange, getProductUnitPrice } from "@/lib/catalog/variants";
import { CartRecommendationShelf } from "@/components/product/recommendation-shelves";

function CartContent() {
  const router = useRouter();
  const restoreToken = useSearchParams().get("recover");
  const { items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount } =
    useCart();
  const restoreHandled = useRef(false);
  const restoreCart = useMutation(api.abandonedCartRecovery.restoreCart);
  const [restoreState, setRestoreState] = useState<{
    token: string;
    cart: Awaited<ReturnType<typeof restoreCart>>;
  } | null>(null);

  const restoredCart = restoreToken
    ? restoreState?.token === restoreToken ? restoreState.cart : undefined
    : null;

  useEffect(() => {
    let cancelled = false;
    restoreHandled.current = false;
    if (!restoreToken) return () => { cancelled = true; };
    void restoreCart({ token: restoreToken })
      .then((cart) => { if (!cancelled) setRestoreState({ token: restoreToken, cart }); })
      .catch(() => { if (!cancelled) setRestoreState({ token: restoreToken, cart: null }); });
    return () => { cancelled = true; };
  }, [restoreCart, restoreToken]);

  const restoredProducts = useQuery(
    api.products.getByIds,
    restoredCart === undefined
      ? "skip"
      : { ids: (restoredCart?.items ?? []).map((item) => item.productId as Id<"products">) },
  );

  useEffect(() => {
    if (!restoreToken || restoredCart === undefined || restoredProducts === undefined || restoreHandled.current) return;
    restoreHandled.current = true;

    if (restoredCart) {
      try {
        setCartRecoverySessionKey(restoredCart.sessionKey);
      } catch {
        // The cart can still be restored when browser storage is unavailable.
      }
    }

    const restoredProductsById = new Map<string, Product>();
    for (const product of restoredProducts ?? []) {
      restoredProductsById.set(product._id, {
        id: product._id,
        slug: product.slug,
        title: product.title,
        price: getProductPriceRange(product).min,
        availableForSale: product.availableForSale ?? true,
        categorySlug: product.categorySlug,
        images: product.images,
        options: product.options,
        variants: product.variants.map(({ price, ...variant }) => ({
          ...variant,
          price: { amount: price, currencyCode: "TRY" },
        })),
        updatedAt: product.updatedAt || new Date(product._creationTime).toISOString(),
      });
    }

    for (const restored of restoredCart?.items ?? []) {
      const product = restoredProductsById.get(restored.productId);
      if (!product?.availableForSale) continue;
      const resolvedVariantId = restored.variantId ?? (product.variants?.length === 1 ? product.variants[0].id : undefined);
      if (product.variants?.length && !resolvedVariantId) continue;
      const variant = resolvedVariantId
        ? product.variants?.find((candidate) => candidate.id === resolvedVariantId)
        : undefined;
      if (resolvedVariantId && (!variant || !variant.availableForSale)) continue;
      const currentQuantity = items.find((item) =>
        item.product.id === product.id && item.variantId === resolvedVariantId
      )?.quantity ?? 0;
      const quantity = Math.max(currentQuantity, Math.min(999, restored.quantity));
      if (currentQuantity > 0) updateQuantity(product.id, quantity, resolvedVariantId);
      else addItem(product, quantity, resolvedVariantId);
    }

    router.replace("/cart");
  }, [addItem, items, restoredCart, restoredProducts, restoreToken, router, updateQuantity]);

  if (restoreToken) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center text-sm text-muted-foreground" aria-busy="true">
        <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <p>Sepetiniz geri yükleniyor...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16 sm:py-24">
        <Card className="mx-auto max-w-md text-center p-8 border-border/80 bg-card/60 shadow-lg backdrop-blur-xs rounded-3xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBagIcon className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Sepetiniz Boş
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz sepetinize bir ürün eklemediniz. İlginizi çeken koleksiyonları keşfetmeye hemen başlayın!
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full shadow-md font-semibold px-8">
              <Link href="/search" className="gap-2">
                <span>Alışverişe Başla</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Alışveriş Sepeti
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sepetinizde toplam {totalCount} adet ürün bulunuyor
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          className="text-xs text-muted-foreground hover:text-destructive self-start sm:self-auto gap-1.5"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          <span>Sepeti Boşalt</span>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Ürün Listesi */}
        <div className="lg:col-span-8">
          <Card className="divide-y divide-border/60 border-border/80 bg-card shadow-sm overflow-hidden rounded-3xl">
            {items.map((item) => {
              const unitPrice = getProductUnitPrice(item.product, item.variantId);
              const lineTotal = (
                parseFloat(unitPrice || "0") * item.quantity
              ).toFixed(2);

              return (
                <div
                  key={`${item.product.id}:${item.variantId ?? ""}`}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="flex-none overflow-hidden rounded-2xl border border-border bg-muted/30"
                    >
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          width={96}
                          height={96}
                          alt={item.product.title}
                          className="h-20 w-20 object-cover sm:h-24 sm:w-24"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center text-muted-foreground sm:h-24 sm:w-24">
                          <ShoppingBagIcon className="h-8 w-8" />
                        </div>
                      )}
                    </Link>

                    <div>
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="text-base font-semibold text-foreground hover:underline line-clamp-1"
                      >
                        {item.product.title}
                      </Link>
                      {item.product.categorySlug && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                            {item.product.categorySlug}
                          </Badge>
                        </div>
                      )}
                      <div className="mt-1.5 text-sm font-semibold text-foreground">
                        {formatMoney(unitPrice)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t border-border/60 sm:border-0">
                    {/* Adet Kontrolü */}
                    <div className="flex items-center rounded-xl border border-border bg-muted/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-background"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1, item.variantId)
                        }
                        aria-label="Azalt"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </Button>
                      <span className="px-3 text-xs font-bold text-foreground">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-background"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1, item.variantId)
                        }
                        aria-label="Arttır"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Satır Toplamı */}
                    <div className="min-w-[80px] text-right font-bold text-foreground">
                      {formatMoney(lineTotal)}
                    </div>

                    {/* Sil Butonu */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.product.id, item.variantId)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Ürünü Sil"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>

          <div className="mt-6">
            <Button asChild variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <Link href="/search">
                <ArrowLeftIcon className="h-4 w-4" />
                <span>Alışverişe Devam Et</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Sipariş Özeti */}
        <div className="lg:col-span-4">
          <Card className="sticky top-24 rounded-3xl border-border/80 bg-card p-6 shadow-sm space-y-5">
            <CardHeader className="p-0">
              <CardTitle className="text-lg font-bold text-foreground">
                Sipariş Özeti
              </CardTitle>
            </CardHeader>
            <Separator />

            <CardContent className="p-0 space-y-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Ara Toplam</span>
                <span className="font-semibold text-foreground">
                  {formatMoney(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Kargo</span>
                <span className="font-medium text-emerald-500">Ücretsiz</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold text-foreground">
                <span>Genel Toplam</span>
                <span className="text-primary">{formatMoney(totalAmount)}</span>
              </div>

              <div className="pt-2">
                <Button asChild size="lg" className="w-full rounded-2xl shadow-lg font-semibold gap-2 h-12">
                  <Link href="/checkout">
                    <span>Ödemeye Geç</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Güven Rozetleri */}
              <div className="pt-2 space-y-2 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="size-4 text-primary" />
                  <span>256-Bit SSL ile güvenli ödeme</span>
                </div>
                <div className="flex items-center gap-2">
                  <TruckIcon className="size-4 text-primary" />
                  <span>Sigortalı ve özenli paketleme</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowPathIcon className="size-4 text-primary" />
                  <span>14 gün içinde koşulsuz kolay iade</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <CartRecommendationShelf />
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center text-sm text-muted-foreground" aria-busy="true">Sepetiniz yükleniyor...</div>}>
      <CartContent />
    </Suspense>
  );
}
