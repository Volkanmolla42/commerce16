"use client";

import { useCart } from "@/components/cart/cart-context";
import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import {
  CheckmarkBadge01Icon,
  ArrowLeft01Icon,
  LockIcon,
  ShoppingBag01Icon,
} from "hugeicons-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  Separator,
  Badge,
} from "@/components/ui";
import { formatMoney } from "@/lib/format-money";
import { getCheckoutDetails, type CheckoutDraft } from "./checkout-details";
import { clearQuickBuyItem, useQuickBuyDraft } from "@/components/cart/quick-buy-store";

function CheckoutContent() {
  const { items: cartItems, clearCart } = useCart();
  const isQuickBuy = useSearchParams().get("mode") === "quick-buy";
  const quickBuy = useQuickBuyDraft();
  const items = isQuickBuy ? (quickBuy.item ? [quickBuy.item] : []) : cartItems;
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + Math.round(Number(item.product.price) * 100) * item.quantity, 0) / 100;
  const { isAuthenticated } = useConvexAuth();

  const profile = useQuery(api.users.getMyProfile);
  const addresses = useQuery(api.addresses.getMyAddresses);
  const createOrder = useMutation(api.orders.createOrder);

  // Form State
  const [draft, setDraft] = useState<CheckoutDraft>({});
  const [addressTitle, setAddressTitle] = useState("Ev");
  const [saveAddressToBook, setSaveAddressToBook] = useState(true);
  const [addressSelection, setAddressSelection] = useState<string | null>(null);
  const { selectedAddressId, customerName, customerEmail, phone, city, district, addressLine } =
    getCheckoutDetails({ profile, addresses, selection: addressSelection, draft });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    id: string;
    total: string;
    email: string;
  } | null>(null);

  const handleAddressSelect = (addressId: string) => {
    setAddressSelection(addressId);
    setDraft((current) => ({
      customerEmail: current.customerEmail,
      ...(addressId === "custom" ? { customerName, phone, city: "", district: "", addressLine: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const fullShippingAddress = `${customerName}, Tel: ${phone} - ${addressLine}, ${district}/${city}`;
    const isNewAddress = selectedAddressId === "custom" || !addresses || addresses.length === 0;
    const shouldSave = isAuthenticated && isNewAddress && saveAddressToBook;

    const saveAddressPayload = shouldSave
      ? {
          title: addressTitle.trim() || "Ev",
          city: city.trim(),
          district: district.trim(),
          addressLine1: addressLine.trim(),
          isDefault: !addresses || addresses.length === 0,
        }
      : undefined;

    try {
      const orderId = await createOrder({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phone.trim() || undefined,
        shippingAddress: fullShippingAddress,
        total: totalAmount.toFixed(2),
        items: items.map((item) => ({
          productId: item.product.id,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          title: item.product.title,
          quantity: item.quantity,
          price: item.product.price,
          image: item.product.images[0],
        })),
        saveAddress: saveAddressPayload,
      });

      const orderData = {
        id: orderId,
        total: totalAmount.toFixed(2),
        email: customerEmail.trim(),
      };

      if (isQuickBuy) clearQuickBuyItem();
      else clearCart();
      setCompletedOrder(orderData);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Sipariş oluşturulurken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (completedOrder) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16 sm:py-24">
        <Card className="mx-auto max-w-lg rounded-3xl p-8 sm:p-12 text-center shadow-xl border-border bg-card">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckmarkBadge01Icon className="h-12 w-12" />
          </div>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Siparişiniz Alındı!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Teşekkür ederiz. Siparişiniz alındı.
          </p>

          <Card className="mt-6 bg-muted/40 p-5 text-left text-xs space-y-2 border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sipariş Numarası:</span>
              <span className="font-mono font-bold text-foreground">
                #{completedOrder.id.slice(-8).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bildirim E-Postası:</span>
              <span className="font-medium text-foreground">
                {completedOrder.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sipariş Tutarı:</span>
              <span className="font-bold text-foreground">
                {formatMoney(completedOrder.total)}
              </span>
            </div>
          </Card>

          {isAuthenticated ? <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="flex-1 rounded-2xl shadow-md font-semibold">
              <Link href={`/account/orders/${completedOrder.id}`}>
                Sipariş Detayını Görüntüle
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 rounded-2xl font-semibold border-border">
              <Link href="/account/orders">Tüm Siparişlerim</Link>
            </Button>
          </div> : (
            <Button asChild size="lg" className="mt-8 rounded-2xl font-semibold">
              <Link href="/search">Alışverişe Devam Et</Link>
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (isQuickBuy && !quickBuy.ready) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center" aria-busy="true">
        <p className="text-sm text-muted-foreground">Hızlı satın alma bilgisi yükleniyor...</p>
      </div>
    );
  }

  // If there is no item to check out
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {isQuickBuy ? "Hızlı Satın Alma Bilgisi Bulunamadı" : "Sipariş Verilecek Ürün Bulunamadı"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isQuickBuy
            ? "Ürünü yeniden seçip hızlı satın alma düğmesine basın."
            : "Sipariş verebilmek için sepetinizde en az bir ürün olmalıdır."}
        </p>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-full shadow-md font-semibold">
            <Link href={isQuickBuy ? "/search" : "/cart"}>
              <span>{isQuickBuy ? "Alışverişe Dön" : "Sepete Dön"}</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <Link href="/cart">
              <ArrowLeft01Icon className="h-4 w-4" />
              <span>Sepete Dön</span>
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Siparişi Tamamla
          </h1>
        </div>

        <Badge variant="outline" className="gap-1.5 py-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 font-medium">
          <LockIcon className="h-3.5 w-3.5" />
          <span>256-Bit SSL Korumalı</span>
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Sol Kolon: Form */}
        <div className="lg:col-span-7 space-y-8">
          {errorMessage && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
              {errorMessage}
            </div>
          )}

          {/* 1. İletişim Bilgileri */}
          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">
                1. İletişim Bilgileri
              </CardTitle>
            </CardHeader>
            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="checkout-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ad Soyad
                </Label>
                <Input
                  id="checkout-name"
                  autoComplete="name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                  placeholder="Adınız ve Soyadınız"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                  E-Posta
                </Label>
                <Input
                  id="checkout-email"
                  autoComplete="email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })}
                  placeholder="ornek@mail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Telefon
                </Label>
                <Input
                  id="checkout-phone"
                  autoComplete="tel"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                />
              </div>
            </div>
          </Card>

          {/* 2. Teslimat Adresi */}
          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">
                2. Teslimat Adresi
              </CardTitle>
            </CardHeader>
            <Separator />

            {/* Kayıtlı Adresler (Giriş Yapmış Kullanıcı İçin) */}
            {isAuthenticated && addresses && addresses.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Kayıtlı Adresleriniz
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr._id}
                      className={`relative flex flex-col p-4 rounded-2xl border cursor-pointer transition ${
                        selectedAddressId === addr._id
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">
                          {addr.title}
                        </span>
                        <input
                          type="radio"
                          name="address"
                          checked={selectedAddressId === addr._id}
                          onChange={() => handleAddressSelect(addr._id)}
                          className="h-4 w-4 accent-primary"
                        />
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {addr.district} / {addr.city}
                      </span>
                      <span className="text-xs text-muted-foreground/80 truncate">
                        {addr.addressLine1}
                      </span>
                    </label>
                  ))}

                  <label
                    className={`relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition ${
                      selectedAddressId === "custom"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <span className="font-semibold text-sm text-foreground">
                      + Farklı Bir Adres Gir
                    </span>
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === "custom"}
                      onChange={() => handleAddressSelect("custom")}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Adres Giriş Alanları veya Seçili Adres Özeti */}
            {selectedAddressId === "custom" || !addresses || addresses.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                {isAuthenticated && (
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="checkout-address-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Adres Başlığı
                    </Label>
                    <Input
                      id="checkout-address-title"
                      type="text"
                      value={addressTitle}
                      onChange={(e) => setAddressTitle(e.target.value)}
                      placeholder="Örn: Ev, İşyeri, Yazlık"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="checkout-city" className="text-xs uppercase tracking-wider text-muted-foreground">
                    İl (Şehir)
                  </Label>
                  <Input
                    id="checkout-city"
                  autoComplete="address-level1"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => {
                      setAddressSelection("custom");
                      setDraft({ ...draft, city: e.target.value });
                    }}
                    placeholder="İstanbul"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-district" className="text-xs uppercase tracking-wider text-muted-foreground">
                    İlçe
                  </Label>
                  <Input
                    id="checkout-district"
                  autoComplete="address-level2"
                    type="text"
                    required
                    value={district}
                    onChange={(e) => {
                      setAddressSelection("custom");
                      setDraft({ ...draft, district: e.target.value });
                    }}
                    placeholder="Kadıköy"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="checkout-address" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Açık Adres (Mahalle, Cadde, Sokak, Kapı No)
                  </Label>
                  <textarea
                    id="checkout-address"
                  autoComplete="street-address"
                    rows={3}
                    required
                    value={addressLine}
                    onChange={(e) => {
                      setAddressSelection("custom");
                      setDraft({ ...draft, addressLine: e.target.value });
                    }}
                    placeholder="Örn: Caferağa Mah. Moda Cad. No: 12 Daire: 4"
                    className="flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                  />
                </div>

                {isAuthenticated && (
                  <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="save-address-checkbox"
                      checked={saveAddressToBook}
                      onChange={(e) => setSaveAddressToBook(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary accent-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="save-address-checkbox" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Bu adresi sonraki siparişlerim için adres defterime kaydet
                    </Label>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-1">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckmarkBadge01Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Teslim Edilecek Adres:</span>{" "}
                      <span className="text-muted-foreground">{addressLine}, {district}/{city}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddressSelect("custom")}
                    className="h-7 text-xs font-medium self-start sm:self-auto"
                  >
                    Farklı Adres Gir
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs">
            <p className="text-xs text-muted-foreground">Siparişiniz ödeme alınmadan oluşturulur.</p>
          </Card>
        </div>

        {/* Sağ Kolon: Sipariş Özeti */}
        <div className="lg:col-span-5">
          <Card className="sticky top-24 rounded-3xl border-border bg-card p-6 shadow-sm space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">
                Sipariş Özeti ({totalCount} Ürün)
              </CardTitle>
            </CardHeader>
            <Separator />

            {/* Ürün Listesi */}
            <div className="max-h-72 overflow-y-auto divide-y divide-border pr-1">
              {items.map((item) => (
                <div key={`${item.product.id}:${item.variantId ?? ""}`} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {item.product.images[0] ? <Image
                      src={item.product.images[0]}
                      width={48}
                      height={48}
                      alt={item.product.title}
                      className="h-12 w-12 rounded-xl object-cover border border-border flex-none"
                    /> : (
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                        <ShoppingBag01Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-foreground line-clamp-1">
                        {item.product.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} adet × {formatMoney(item.product.price)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {formatMoney(parseFloat(item.product.price || "0") * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Fiyat Detayı */}
            <Separator />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Ara Toplam</span>
                <span>{formatMoney(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Kargo</span>
                <Badge variant="success">Ücretsiz</Badge>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold text-foreground pt-1">
                <span>Toplam</span>
                <span>{formatMoney(totalAmount)}</span>
              </div>
            </div>

            {/* Buton */}
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-2xl shadow-lg font-semibold gap-2 h-14"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Sipariş İşleniyor...</span>
                </>
              ) : (
                <>
                  <LockIcon className="h-4 w-4" />
                  <span>Siparişi Oluştur ({formatMoney(totalAmount)})</span>
                </>
              )}
            </Button>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              Siparişi tamamlayarak Kullanım Koşulları ve Gizlilik Politikası&apos;nı kabul etmiş olursunuz.
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center" aria-busy="true">
        <p className="text-sm text-muted-foreground">Sipariş sayfası açılıyor...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
