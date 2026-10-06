"use client";

import { useCart } from "@/components/cart/cart-context";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag01Icon,
  Delete02Icon,
  PlusSignIcon,
  MinusSignIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  SecurityCheckIcon,
  DeliveryTruck01Icon,
  Refresh01Icon,
} from "hugeicons-react";
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

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, totalCount, totalAmount } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16 sm:py-24">
        <Card className="mx-auto max-w-md text-center p-8 border-border bg-card shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag01Icon className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Sepetiniz Boş
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Alışveriş sepetinizde henüz herhangi bir ürün bulunmuyor. İlginizi çeken ürünleri ekleyerek başlayın.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full shadow-md font-semibold">
              <Link href="/search" className="gap-2">
                <span>Ürünleri Keşfet</span>
                <ArrowRight01Icon className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Alışveriş Sepeti
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam {totalCount} adet ürün bulunuyor
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          className="text-xs text-muted-foreground hover:text-destructive self-start sm:self-auto gap-1.5"
        >
          <Delete02Icon className="h-3.5 w-3.5" />
          <span>Sepeti Temizle</span>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Ürün Listesi */}
        <div className="lg:col-span-8">
          <Card className="divide-y divide-border border-border bg-card shadow-sm overflow-hidden rounded-3xl">
            {items.map((item) => {
              const lineTotal = (
                parseFloat(item.product.price || "0") * item.quantity
              ).toFixed(2);

              return (
                <div
                  key={`${item.product.id}:${item.variantId ?? ""}`}
                  className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="flex-none overflow-hidden rounded-2xl border border-border bg-muted/30"
                    >
                      {item.product.images[0] ? <Image
                        src={item.product.images[0]}
                        width={96}
                        height={96}
                        alt={item.product.title}
                        className="h-24 w-24 object-cover transition hover:scale-105"
                      /> : (
                        <div className="flex h-24 w-24 items-center justify-center text-muted-foreground">
                          <ShoppingBag01Icon className="h-8 w-8" />
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
                        {formatMoney(item.product.price)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t border-border sm:border-0">
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
                        <MinusSignIcon className="h-3.5 w-3.5" />
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
                        <PlusSignIcon className="h-3.5 w-3.5" />
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
                      <Delete02Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>

          <div className="mt-6">
            <Button asChild variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <Link href="/search">
                <ArrowLeft01Icon className="h-4 w-4" />
                <span>Alışverişe Devam Et</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Sipariş Özeti */}
        <div className="lg:col-span-4">
          <Card className="sticky top-24 rounded-3xl border-border bg-card p-6 shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-bold text-foreground">
                Sipariş Özeti
              </CardTitle>
            </CardHeader>
            <Separator />

            <CardContent className="p-0 pt-4 space-y-3.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Ara Toplam</span>
                <span className="font-semibold text-foreground">
                  {formatMoney(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tahmini Kargo</span>
                <Badge variant="success">Ücretsiz</Badge>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>KDV</span>
                <span className="font-semibold text-foreground">Dahil</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold text-foreground pt-1">
                <span>Genel Toplam</span>
                <span>{formatMoney(totalAmount)}</span>
              </div>

              <div className="pt-4">
                <Button asChild size="lg" className="w-full rounded-2xl shadow-lg font-semibold gap-2">
                  <Link href="/checkout">
                    <span>Ödemeye Geç</span>
                    <ArrowRight01Icon className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="pt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2.5">
                  <SecurityCheckIcon className="h-4 w-4 text-emerald-500 flex-none" />
                  <span>256-Bit SSL ile Güvenli Ödeme Altyapısı</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <DeliveryTruck01Icon className="h-4 w-4 text-primary flex-none" />
                  <span>Tüm Siparişlerde Hızlı & Ücretsiz Kargo</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Refresh01Icon className="h-4 w-4 text-muted-foreground flex-none" />
                  <span>30 Gün Koşulsuz İade ve Değişim Garantisi</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
