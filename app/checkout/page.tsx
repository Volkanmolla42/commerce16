"use client";

import { useCart, type CartItem } from "@/components/cart/cart-context";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import {
  CheckBadgeIcon,
  ShoppingBagIcon,
  LockClosedIcon,
  ChevronDownIcon,
  TagIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/ui";
import { formatMoney } from "@/lib/format-money";
import { getCheckoutDetails, type CheckoutDraft } from "./checkout-details";
import { clearQuickBuyItem, useQuickBuyDraft } from "@/components/cart/quick-buy-store";
import { clearCartRecoverySessionKey, getCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { getAnalyticsSessionIdForOrder, trackAnalyticsEvent } from "@/lib/analytics-client";
import { getProvinceById, TURKEY_PROVINCES } from "@/lib/turkey-provinces";
import { getProductUnitPrice } from "@/lib/catalog/variants";

type CouponPreview = {
  valid: boolean;
  code?: string;
  message?: string;
  discountKurus?: number;
} | null | undefined;

function OrderItemsList({ items }: { items: CartItem[] }) {
  return (
    <div className="divide-y divide-border/60">
      {items.map((item) => {
        const unitPrice = Number(getProductUnitPrice(item.product, item.variantId));
        const lineTotal = unitPrice * item.quantity;
        return (
          <div key={`${item.product.id}:${item.variantId ?? ""}`} className="flex items-center gap-3 py-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
              {item.product.images[0] ? (
                <Image
                  src={item.product.images[0].url}
                  width={56}
                  height={56}
                  alt={item.product.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ShoppingBagIcon className="size-6" />
                </div>
              )}
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-xs">
                {item.quantity}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-xs sm:text-sm font-medium leading-snug text-foreground">
                {item.product.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.quantity} adet × {formatMoney(unitPrice)}
              </p>
            </div>

            <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(lineTotal)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CouponSection({
  idPrefix = "checkout",
  couponInput,
  setCouponInput,
  handleApplyCoupon,
  couponPreview,
  appliedCouponCode,
}: {
  idPrefix?: string;
  couponInput: string;
  setCouponInput: (val: string) => void;
  handleApplyCoupon: () => void;
  couponPreview: CouponPreview;
  appliedCouponCode: string;
}) {
  return (
    <div className="space-y-2 pt-1">
      <Label htmlFor={`${idPrefix}-coupon`} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <TagIcon className="size-4 text-muted-foreground" />
        <span>İndirim Kuponu</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-coupon`}
          value={couponInput}
          onChange={(event) => setCouponInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleApplyCoupon();
            }
          }}
          maxLength={32}
          autoCapitalize="characters"
          placeholder="Kupon kodunuz"
          aria-describedby={`${idPrefix}-coupon-status`}
          className="h-11 text-sm uppercase placeholder:normal-case font-medium min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!couponInput.trim()}
          onClick={handleApplyCoupon}
          className="h-11 px-4 text-sm font-medium shrink-0 cursor-pointer"
        >
          Uygula
        </Button>
      </div>
      <p
        id={`${idPrefix}-coupon-status`}
        role="status"
        aria-live="polite"
        className={`min-h-4 text-xs font-medium ${
          couponPreview?.valid
            ? "text-emerald-600 dark:text-emerald-400"
            : appliedCouponCode
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      >
        {couponPreview?.valid
          ? `✓ "${couponPreview.code}" kuponu uygulandı.`
          : couponPreview && !couponPreview.valid
            ? `✕ ${couponPreview.message}`
            : appliedCouponCode
              ? "Kupon kontrol ediliyor…"
              : ""}
      </p>
    </div>
  );
}

function PriceSummaryRows({
  totalAmount,
  couponDiscountKurus,
  couponPreview,
  appliedCouponCode,
  payableAmount,
}: {
  totalAmount: number;
  couponDiscountKurus: number;
  couponPreview: CouponPreview;
  appliedCouponCode: string;
  payableAmount: number;
}) {
  return (
    <div className="space-y-2 pt-1 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Ara Toplam</span>
        <span className="font-medium tabular-nums text-foreground">{formatMoney(totalAmount)}</span>
      </div>
      {couponDiscountKurus > 0 && (
        <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
          <span>Kupon İndirimi ({couponPreview?.valid ? couponPreview.code : appliedCouponCode})</span>
          <span className="tabular-nums">−{formatMoney(couponDiscountKurus / 100)}</span>
        </div>
      )}
      <Separator className="my-2" />
      <div className="flex items-baseline justify-between pt-1">
        <span className="text-base font-semibold text-foreground">Toplam</span>
        <span className="text-lg font-bold tabular-nums text-foreground sm:text-xl">
          {formatMoney(payableAmount)}
        </span>
      </div>
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const { items: cartItems, clearCart } = useCart();
  const isQuickBuy = useSearchParams().get("mode") === "quick-buy";
  const quickBuy = useQuickBuyDraft();
  const items = isQuickBuy ? (quickBuy.item ? [quickBuy.item] : []) : cartItems;
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalKurus = items.reduce(
    (sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity,
    0
  );
  const totalAmount = subtotalKurus / 100;
  const { isAuthenticated } = useConvexAuth();

  const profile = useQuery(api.users.getMyProfile);
  const addresses = useQuery(api.addresses.getMyAddresses);
  const recoveryAvailability = useQuery(api.abandonedCartRecovery.getAvailability, {});
  const legalDocuments = useQuery(api.legalDocuments.getCheckoutDocuments, {});

  const [couponCheckTime, setCouponCheckTime] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setCouponCheckTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const couponPreview = useQuery(
    api.coupons.preview,
    appliedCouponCode ? { code: appliedCouponCode, subtotalKurus, now: couponCheckTime } : "skip"
  );
  const couponDiscountKurus = couponPreview?.valid ? couponPreview.discountKurus : 0;
  const payableKurus = Math.max(0, subtotalKurus - couponDiscountKurus);
  const payableAmount = payableKurus / 100;

  const createOrder = useMutation(api.orders.createOrder);
  const captureRecovery = useMutation(api.abandonedCartRecovery.capture);
  const linkRecoveryOrder = useMutation(api.abandonedCartRecovery.linkOrder);

  // Form State
  const [draft, setDraft] = useState<CheckoutDraft>({});
  const [addressTitle, setAddressTitle] = useState("Ev");
  const [saveAddressToBook, setSaveAddressToBook] = useState(true);
  const [addressSelection, setAddressSelection] = useState<string | null>(null);
  const { selectedAddressId, customerName, customerEmail, phone, city, district, addressLine, provinceId, districtId } =
    getCheckoutDetails({ profile, addresses, selection: addressSelection, draft });
  const districtOptions = getProvinceById(provinceId)?.districts ?? [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [preInformationAccepted, setPreInformationAccepted] = useState(false);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);

  useEffect(() => {
    if (items.length > 0) void trackAnalyticsEvent("begin_checkout");
  }, [items.length]);

  const itemsKey = items.map((item) => `${item.product.id}:${item.variantId ?? ""}:${item.quantity}`).join(",");

  useEffect(() => {
    if (items.length === 0) return;
    let sessionKey: string | null;
    try {
      sessionKey = getCartRecoverySessionKey(emailReminderConsent);
    } catch {
      return;
    }
    if (!sessionKey) return;
    const timeout = window.setTimeout(() => {
      void captureRecovery({
        sessionKey,
        ...(emailReminderConsent ? { email: customerEmail } : {}),
        emailConsent: emailReminderConsent,
        items: emailReminderConsent
          ? items.map((item) => ({
            productId: item.product.id,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: item.quantity,
          }))
          : [],
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureRecovery, customerEmail, emailReminderConsent, itemsKey]);

  const handleAddressSelect = (addressId: string) => {
    setAddressSelection(addressId);
    if (addressId === "custom") {
      setDraft((current) => ({
        customerName,
        customerEmail: current.customerEmail,
        phone,
        city: "",
        district: "",
        addressLine: "",
        provinceId: "",
        districtId: "",
      }));
    } else {
      setDraft((current) => ({ customerEmail: current.customerEmail }));
    }
  };

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    setAppliedCouponCode(couponInput.trim().toLocaleUpperCase("en-US"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready) {
      setErrorMessage("Ödeme açılamıyor: yasal sözleşmeler henüz hazır değil.");
      setIsSubmitting(false);
      return;
    }
    if (!preInformationAccepted || !agreementAccepted) {
      setErrorMessage("Sipariş vermeden önce Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ni onaylamalısınız.");
      setIsSubmitting(false);
      return;
    }

    if (!provinceId || !districtId) {
      setErrorMessage("Teslimat için lütfen geçerli bir il ve ilçe seçin.");
      setIsSubmitting(false);
      return;
    }
    if (appliedCouponCode && !couponPreview?.valid) {
      setErrorMessage(
        couponPreview && !couponPreview.valid
          ? couponPreview.message
          : "Kupon doğrulanıyor. Biraz bekleyip tekrar deneyin."
      );
      setIsSubmitting(false);
      return;
    }
    if (payableKurus <= 0) {
      setErrorMessage("Kupon indirimi sepet toplamını sıfırlıyor.");
      setIsSubmitting(false);
      return;
    }
    const fullShippingAddress = `${customerName}, Tel: ${phone} - ${addressLine}, ${district}/${city}`;
    const isNewAddress = selectedAddressId === "custom" || !addresses || addresses.length === 0;
    const shouldSave = isAuthenticated && isNewAddress && saveAddressToBook;

    const saveAddressPayload = shouldSave
      ? {
        title: addressTitle.trim() || "Ev",
        city: city.trim(),
        district: district.trim(),
        provinceId,
        districtId,
        addressLine1: addressLine.trim(),
        isDefault: !addresses || addresses.length === 0,
      }
      : undefined;

    try {
      let recoverySessionKey: string | null = null;
      try {
        recoverySessionKey = getCartRecoverySessionKey(emailReminderConsent);
      } catch {
        recoverySessionKey = null;
      }

      if (recoverySessionKey && items.length > 0) {
        await captureRecovery({
          sessionKey: recoverySessionKey,
          ...(emailReminderConsent ? { email: customerEmail } : {}),
          emailConsent: emailReminderConsent,
          items: emailReminderConsent
            ? items.map((item) => ({
              productId: item.product.id,
              ...(item.variantId ? { variantId: item.variantId } : {}),
              quantity: item.quantity,
            }))
            : [],
        }).catch(() => undefined);
      }

      const analyticsSessionId = getAnalyticsSessionIdForOrder();
      const orderId = await createOrder({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phone.trim() || undefined,
        ...(analyticsSessionId ? { analyticsSessionId } : {}),
        shippingAddress: fullShippingAddress,
        total: payableAmount.toFixed(2),
        ...(couponPreview?.valid ? { couponCode: couponPreview.code } : {}),
        provinceId,
        districtId,
        items: items.map((item) => ({
          productId: item.product.id,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          title: item.product.title,
          quantity: item.quantity,
          price: getProductUnitPrice(item.product, item.variantId),
          image: item.product.images[0]?.url,
        })),
        saveAddress: saveAddressPayload,
        legalAcceptance: {
          accepted: true as const,
          distanceSalesAgreementVersion: legalDocuments.distanceSalesAgreement.version,
          preInformationFormVersion: legalDocuments.preInformationForm.version,
        },
      });

      if (recoverySessionKey && emailReminderConsent) {
        await linkRecoveryOrder({ sessionKey: recoverySessionKey, orderId }).catch(() => undefined);
      }

      clearCart();
      clearQuickBuyItem();
      try {
        clearCartRecoverySessionKey();
      } catch {
        // Ignored
      }
      router.push("/checkout/result?status=success");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Sipariş oluşturulurken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isQuickBuy && !quickBuy.ready) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center" aria-busy="true">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Hızlı satın alma bilgisi yükleniyor...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShoppingBagIcon className="size-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          {isQuickBuy ? "Hızlı Satın Alma Bilgisi Bulunamadı" : "Sipariş Verilecek Ürün Yok"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isQuickBuy
            ? "Lütfen ürünü yeniden seçip hızlı satın al butonuna tıklayın."
            : "Sipariş verebilmek için sepetinizde en az bir ürün bulunmalıdır."}
        </p>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-full px-8 font-semibold">
            <Link href={isQuickBuy ? "/search" : "/cart"}>
              <span>{isQuickBuy ? "Alışverişe Devam Et" : "Sepete Dön"}</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-4 sm:px-6 sm:py-8 pb-28 sm:pb-12 overflow-x-clip">
      {/* SİPARİŞ FORMU */}
      <form id="checkout-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* Sol Kolon: Form Alanları */}
        <div className="space-y-6 lg:col-span-7">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive animate-fade-in"
            >
              <span className="mt-0.5 shrink-0 font-bold">✕</span>
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* MOBİL SİPARİŞ ÖZETİ (Mobilde en başta, açık ve net) */}
          <Card className="rounded-2xl border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBagIcon className="size-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Sipariş Özeti ({totalCount} Ürün)
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatMoney(payableAmount)}
              </span>
            </div>

            <Separator />

            {/* Ürün Listesi */}
            <OrderItemsList items={items} />

            <Separator />

            {/* İndirim Kuponu */}
            <CouponSection
              idPrefix="mobile"
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              handleApplyCoupon={handleApplyCoupon}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
            />

            <Separator />

            {/* Fiyat Dökümü */}
            <PriceSummaryRows
              totalAmount={totalAmount}
              couponDiscountKurus={couponDiscountKurus}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
              payableAmount={payableAmount}
            />
          </Card>

          {/* 1. İletişim Bilgileri */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                1. İletişim Bilgileri
              </CardTitle>
            </CardHeader>
            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="checkout-name" className="text-sm font-medium text-foreground">
                  Ad Soyad
                </Label>
                <Input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                  placeholder="Adınız ve Soyadınız"
                  className="h-11 text-base sm:text-sm rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-email" className="text-sm font-medium text-foreground">
                  E-Posta
                </Label>
                <Input
                  id="checkout-email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })}
                  placeholder="ornek@mail.com"
                  className="h-11 text-base sm:text-sm rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-phone" className="text-sm font-medium text-foreground">
                  Telefon
                </Label>
                <Input
                  id="checkout-phone"
                  name="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="h-11 text-base sm:text-sm rounded-xl"
                />
              </div>
            </div>
          </Card>

          {/* 2. Teslimat Adresi */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                2. Teslimat Adresi
              </CardTitle>
            </CardHeader>
            <Separator />

            {/* Kayıtlı Adresler (Giriş Yapmış Kullanıcı İçin) */}
            {isAuthenticated && addresses && addresses.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kayıtlı Adresleriniz
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr._id;
                    return (
                      <label
                        key={addr._id}
                        className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition select-none ${isSelected
                            ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/40 bg-card"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">
                            {addr.title}
                          </span>
                          <input
                            type="radio"
                            name="address"
                            checked={isSelected}
                            onChange={() => handleAddressSelect(addr._id)}
                            className="size-4 accent-primary"
                          />
                        </div>
                        <span className="mt-1 text-xs font-medium text-foreground/90">
                          {addr.district} / {addr.city}
                        </span>
                        <span className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {addr.addressLine1}
                        </span>
                      </label>
                    );
                  })}

                  <label
                    className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition select-none ${selectedAddressId === "custom"
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/40 bg-card"
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
                      className="size-4 accent-primary"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Adres Giriş Alanları */}
            {selectedAddressId === "custom" || !addresses || addresses.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isAuthenticated && (
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="checkout-address-title" className="text-sm font-medium text-foreground">
                      Adres Başlığı
                    </Label>
                    <Input
                      id="checkout-address-title"
                      type="text"
                      value={addressTitle}
                      onChange={(e) => setAddressTitle(e.target.value)}
                      placeholder="Örn: Ev, İşyeri, Yazlık"
                      className="h-11 text-base sm:text-sm rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="checkout-city" className="text-sm font-medium text-foreground">
                    İl (Şehir)
                  </Label>
                  <div className="relative">
                    <select
                      id="checkout-city"
                      name="city"
                      required
                      autoComplete="address-level1"
                      value={provinceId}
                      onChange={(e) => {
                        const province = getProvinceById(e.target.value);
                        setAddressSelection("custom");
                        setDraft((current) => ({
                          ...current,
                          provinceId: province?.id ?? "",
                          city: province?.name ?? "",
                          districtId: "",
                          district: "",
                        }));
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 text-base sm:text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition shadow-2xs"
                    >
                      <option value="">İl seçin</option>
                      {TURKEY_PROVINCES.map((province) => (
                        <option key={province.id} value={province.id}>
                          {province.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-district" className="text-sm font-medium text-foreground">
                    İlçe
                  </Label>
                  <div className="relative">
                    <select
                      id="checkout-district"
                      name="district"
                      required
                      autoComplete="address-level2"
                      value={districtId}
                      disabled={!provinceId}
                      onChange={(e) => {
                        setAddressSelection("custom");
                        const selectedDistrict = districtOptions.find((option) => option.id === e.target.value);
                        setDraft((current) => ({
                          ...current,
                          districtId: selectedDistrict?.id ?? "",
                          district: selectedDistrict?.name ?? "",
                        }));
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 text-base sm:text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 transition shadow-2xs"
                    >
                      <option value="">{provinceId ? "İlçe seçin" : "Önce il seçin"}</option>
                      {[...districtOptions]
                        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                        .map((districtOption) => (
                          <option key={districtOption.id} value={districtOption.id}>
                            {districtOption.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="checkout-address" className="text-sm font-medium text-foreground">
                    Açık Adres
                  </Label>
                  <textarea
                    id="checkout-address"
                    name="street-address"
                    autoComplete="street-address"
                    rows={3}
                    required
                    value={addressLine}
                    onChange={(e) => {
                      setAddressSelection("custom");
                      setDraft({ ...draft, addressLine: e.target.value });
                    }}
                    placeholder="Mahalle, cadde, sokak, bina ve daire no..."
                    className="flex w-full rounded-xl border border-input bg-background p-3 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition resize-none shadow-2xs"
                  />
                </div>

                {isAuthenticated && (
                  <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="save-address-checkbox"
                      checked={saveAddressToBook}
                      onChange={(e) => setSaveAddressToBook(e.target.checked)}
                      className="size-4 rounded border-input accent-primary cursor-pointer"
                    />
                    <Label htmlFor="save-address-checkbox" className="text-xs sm:text-sm text-muted-foreground cursor-pointer select-none">
                      Bu adresi sonraki siparişlerim için kaydet
                    </Label>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                    <CheckBadgeIcon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">Teslimat Adresi:</div>
                    <div className="text-muted-foreground truncate">{addressLine}, {district}/{city}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddressSelect("custom")}
                  className="h-8 text-xs font-medium self-start sm:self-auto shrink-0"
                >
                  Değiştir
                </Button>
              </div>
            )}
          </Card>

          {/* 3. Sipariş Onayı */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                3. Sipariş Onayı
              </CardTitle>
            </CardHeader>
            <Separator />

            <fieldset className="space-y-3">
              <legend className="sr-only">Sipariş sözleşmeleri</legend>
              {!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready ? (
                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  Ödeme için Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu içerikleri kodda tamamlanmalı.
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition cursor-pointer select-none">
                    <input
                      type="checkbox"
                      required
                      checked={preInformationAccepted}
                      onChange={(e) => setPreInformationAccepted(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary rounded cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <Link
                        href={`/${legalDocuments.preInformationForm.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline underline-offset-2 hover:text-primary inline-flex items-center gap-0.5"
                      >
                        <span>Ön Bilgilendirme Formu</span>
                        <ArrowTopRightOnSquareIcon className="size-3 inline" />
                      </Link>{" "}
                      içeriğini ödeme öncesinde inceledim ve formu aldığımı onaylıyorum.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition cursor-pointer select-none">
                    <input
                      type="checkbox"
                      required
                      checked={agreementAccepted}
                      onChange={(e) => setAgreementAccepted(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary rounded cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <Link
                        href={`/${legalDocuments.distanceSalesAgreement.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-foreground underline underline-offset-2 hover:text-primary inline-flex items-center gap-0.5"
                      >
                        <span>Mesafeli Satış Sözleşmesi</span>
                        <ArrowTopRightOnSquareIcon className="size-3 inline" />
                      </Link>{" "}
                      koşullarını okudum ve kabul ediyorum.
                    </span>
                  </label>
                </>
              )}

              {recoveryAvailability?.email && (
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition cursor-pointer select-none">
                  <input
                    id="cart-reminder-email-consent"
                    name="cart-reminder-email-consent"
                    type="checkbox"
                    checked={emailReminderConsent}
                    onChange={(event) => setEmailReminderConsent(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-primary rounded cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Sepetimdeki ürünleri tamamlamam için e-posta ile bir hatırlatma gönderilmesine izin veriyorum.
                  </span>
                </label>
              )}
            </fieldset>
          </Card>
        </div>

        {/* Sağ Kolon: Masaüstü Sipariş Özeti */}
        <div className="hidden lg:block lg:col-span-5">
          <Card className="sticky top-20 rounded-2xl border-border bg-card p-6 shadow-sm space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold text-foreground">
                Sipariş Özeti ({totalCount} Ürün)
              </CardTitle>
            </CardHeader>
            <Separator />

            <div className="max-h-80 overflow-y-auto pr-1">
              <OrderItemsList items={items} />
            </div>

            <Separator />
            <CouponSection
              idPrefix="desktop"
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              handleApplyCoupon={handleApplyCoupon}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
            />

            <Separator />
            <PriceSummaryRows
              totalAmount={totalAmount}
              couponDiscountKurus={couponDiscountKurus}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
              payableAmount={payableAmount}
            />

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="mt-4 w-full h-12 rounded-xl shadow-md font-semibold text-sm gap-2 cursor-pointer transition hover:opacity-95"
            >
              {isSubmitting ? (
                <>
                  <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Sipariş İşleniyor...</span>
                </>
              ) : (
                <>
                  <LockClosedIcon className="size-4" />
                  <span>Siparişi Tamamla ({formatMoney(payableAmount)})</span>
                </>
              )}
            </Button>
          </Card>
        </div>
      </form>

      {/* MOBİL SABİT ALT BUTON ÇUBUĞU */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3.5 backdrop-blur-md shadow-2xl lg:hidden safe-area-bottom">
        <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-1">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-muted-foreground font-medium block">
              Toplam Tutar
            </span>
            <div className="text-lg font-bold tabular-nums text-foreground truncate">
              {formatMoney(payableAmount)}
            </div>
          </div>

          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            disabled={isSubmitting}
            className="h-12 px-6 rounded-xl font-semibold text-sm gap-2 shrink-0 shadow-md cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                <span>İşleniyor...</span>
              </>
            ) : (
              <>
                <LockClosedIcon className="size-4" />
                <span>Siparişi Tamamla</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center" aria-busy="true">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Sipariş sayfası açılıyor...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
