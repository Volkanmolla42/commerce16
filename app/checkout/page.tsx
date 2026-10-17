"use client";

import { useCart, type CartItem } from "@/components/cart/cart-context";
import { Suspense, useEffect, useRef, useState } from "react";
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
  CreditCardIcon,
  BanknotesIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
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
import { MobileSummaryBar, mobileSummaryActionClassName } from "@/components/layout/mobile-summary-bar";
import { formatMoney } from "@/lib/format-money";
import { formatPhoneInput } from "@/lib/format-phone-input";
import { getCheckoutDetails, type CheckoutDraft } from "./checkout-details";
import { useQuickBuyItem } from "@/components/cart/quick-buy-store";
import { getCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { getAnalyticsSessionIdForOrder, trackAnalyticsEvent } from "@/lib/analytics-client";
import { trackPixelInitiateCheckout } from "@/lib/analytics/meta-pixel";
import { getProvinceById, TURKEY_PROVINCES } from "@/lib/turkey-provinces";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { quotePromotions } from "@/lib/promotions";

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
                  className="size-full object-contain"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ShoppingBagIcon className="size-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-medium leading-snug text-foreground sm:text-sm">
                {item.product.title}
              </h3>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {item.quantity} adet × {formatMoney(unitPrice)}
                </p>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(lineTotal)}
                </span>
              </div>
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
          placeholder="Kupon kodunuz"
          aria-describedby={`${idPrefix}-coupon-status`}
          className="h-11 text-sm font-medium min-w-0 flex-1"
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
        className={`min-h-4 text-xs font-medium ${couponPreview?.valid
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
  couponDiscountKurus,
  couponPreview,
  appliedCouponCode,
  payableAmount,
  paymentFee = 0,
  shippingFee = 0,
  isFreeShipping = true,
  promotionDiscountKurus = 0,
  promotionTitle = null,
  freeShippingTitle = null,
}: {
  couponDiscountKurus: number;
  couponPreview: CouponPreview;
  appliedCouponCode: string;
  payableAmount: number;
  paymentFee?: number;
  shippingFee?: number;
  isFreeShipping?: boolean;
  promotionDiscountKurus?: number;
  promotionTitle?: string | null;
  freeShippingTitle?: string | null;
}) {
  return (
    <div className="space-y-2 pt-1 text-sm">
      {couponDiscountKurus > 0 && (
        <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
          <span>Kupon İndirimi ({couponPreview?.valid ? couponPreview.code : appliedCouponCode})</span>
          <span className="tabular-nums">−{formatMoney(couponDiscountKurus / 100)}</span>
        </div>
      )}
      {promotionDiscountKurus > 0 && (
        <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
          <span>Kampanya{promotionTitle ? ` (${promotionTitle})` : ""}</span>
          <span className="tabular-nums">−{formatMoney(promotionDiscountKurus / 100)}</span>
        </div>
      )}
      <div className="flex justify-between text-muted-foreground">
        <span>Kargo</span>
        {isFreeShipping ? (
          <span className="text-right font-medium text-emerald-600 dark:text-emerald-400">
            Ücretsiz{freeShippingTitle ? ` (${freeShippingTitle})` : ""}
          </span>
        ) : (
          <span className="font-medium tabular-nums text-foreground">+{formatMoney(shippingFee)}</span>
        )}
      </div>
      {paymentFee > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Kapıda Ödeme Hizmet Bedeli</span>
          <span className="font-medium tabular-nums text-foreground">+{formatMoney(paymentFee)}</span>
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

function SubmitButtonContent({ isSubmitting }: { isSubmitting: boolean }) {
  if (isSubmitting) {
    return (
      <>
        <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        <span>Sipariş İşleniyor...</span>
      </>
    );
  }
  return (
    <>
      <LockClosedIcon className="size-4" />
      <span>Siparişi Tamamla</span>
    </>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const { items: cartItems } = useCart();
  const isQuickBuy = useSearchParams().get("mode") === "quick-buy";
  const quickBuyItem = useQuickBuyItem();
  const items = isQuickBuy ? (quickBuyItem ? [quickBuyItem] : []) : cartItems;
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalKurus = items.reduce(
    (sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity,
    0
  );
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
  const activePromotions = useQuery(api.promotions.listActive, {});
  const promotion = quotePromotions(
    items.map((item) => ({
      productId: item.product.id,
      unitPriceKurus: Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100),
      quantity: item.quantity,
      categorySlug: item.product.categorySlug,
    })),
    activePromotions ?? [],
    payableKurus,
    subtotalKurus,
  );
  const promotionDiscountKurus = promotion.discountKurus;
  const discountedPayableKurus = Math.max(0, payableKurus - promotionDiscountKurus);

  const paymentSettings = useQuery(api.payments.getPaymentSettings, {});
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const quotesReady = activePromotions !== undefined && storeSettings !== undefined && paymentSettings !== undefined;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"paytr" | "bank_transfer" | "cash_on_delivery" | null>(null);

  // Demo kart bilgileri (PayTR)
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const effectivePaymentMethod = selectedPaymentMethod ?? (
    paymentSettings?.paytr.enabled
      ? "paytr"
      : paymentSettings?.bankTransfer.enabled
        ? "bank_transfer"
        : paymentSettings?.cashOnDelivery.enabled
          ? "cash_on_delivery"
          : null
  );

  const codFee = (effectivePaymentMethod === "cash_on_delivery" && paymentSettings?.cashOnDelivery.enabled)
    ? (paymentSettings.cashOnDelivery.fee || 0)
    : 0;
  const codFeeKurus = Math.round(codFee * 100);

  const freeShippingThreshold = storeSettings?.freeShippingThreshold ?? 0;
  const standardShippingFee = storeSettings?.shippingFee ?? 0;
  const isFreeShipping = promotion.freeShipping || freeShippingThreshold <= 0 || (subtotalKurus / 100) >= freeShippingThreshold;
  const shippingFee = isFreeShipping ? 0 : standardShippingFee;
  const shippingFeeKurus = Math.round(shippingFee * 100);

  const finalPayableKurus = discountedPayableKurus + codFeeKurus + shippingFeeKurus;
  const finalPayableAmount = finalPayableKurus / 100;

  const fillDemoCard = () => {
    setCardHolder("Ahmet Yılmaz");
    setCardNumber("5423 4567 8901 2345");
    setCardExpiry("12/28");
    setCardCvv("123");
  };

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
  const errorRef = useRef<HTMLDivElement>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [preInformationAccepted, setPreInformationAccepted] = useState(false);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);

  useEffect(() => {
    if (!errorMessage) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorMessage]);

  const hasTrackedCheckoutRef = useRef(false);

  useEffect(() => {
    if (items.length > 0 && !hasTrackedCheckoutRef.current) {
      hasTrackedCheckoutRef.current = true;
      void trackAnalyticsEvent("begin_checkout");
      trackPixelInitiateCheckout({
        value: finalPayableAmount,
        currency: "TRY",
        num_items: items.reduce((acc, item) => acc + item.quantity, 0),
        content_ids: items.map((item) => (item.variantId ? `${item.product.id}_${item.variantId}` : item.product.id)),
      });
    }
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

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!quotesReady) {
      setErrorMessage("Fiyatlar hazırlanıyor. Birkaç saniye sonra tekrar deneyin.");
      setIsSubmitting(false);
      return;
    }

    if (!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready) {
      setErrorMessage("Sözleşmeler onaya hazır değil: mağaza ayarlarındaki satıcı bilgilerini tamamlayın.");
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
    if (discountedPayableKurus <= 0) {
      setErrorMessage("İndirimler sepet toplamını sıfırlıyor.");
      setIsSubmitting(false);
      return;
    }
    if (!effectivePaymentMethod) {
      setErrorMessage("Lütfen geçerli bir ödeme yöntemi seçin.");
      setIsSubmitting(false);
      return;
    }
    if (effectivePaymentMethod === "paytr") {
      if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
        setErrorMessage("Lütfen kart bilgilerini girin veya 'Demo Kart Bilgilerini Doldur' butonuna tıklayın.");
        setIsSubmitting(false);
        return;
      }
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

      // PayTR Demo simülasyonu: 600ms işlem efekti
      if (effectivePaymentMethod === "paytr") {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      const analyticsSessionId = getAnalyticsSessionIdForOrder();
      const orderId = await createOrder({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phone.trim() || undefined,
        ...(analyticsSessionId ? { analyticsSessionId } : {}),
        shippingAddress: fullShippingAddress,
        total: finalPayableAmount.toFixed(2),
        paymentMethod: effectivePaymentMethod,
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

      router.replace(`/checkout/success/${orderId}`);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : "Sipariş oluşturulurken bir hata oluştu.");
    }
  };

  if (items.length === 0 && !isSubmitting) {
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
    <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-8 pb-28 sm:pb-12">
      {/* SİPARİŞ FORMU */}
      <form id="checkout-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* Sol Kolon: Form Alanları */}
        <div className="space-y-6 lg:col-span-7">
          {errorMessage && (
            <div
              ref={errorRef}
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive animate-fade-in"
            >
              <span className="mt-0.5 shrink-0 font-bold">✕</span>
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* MOBİL SİPARİŞ ÖZETİ (Mobilde en başta, açık ve net) */}
          <Card className="rounded-2xl border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 lg:hidden">
            <div className="flex items-center gap-2">
              <ShoppingBagIcon className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Sipariş Özeti ({totalCount} Ürün)
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
              couponDiscountKurus={couponDiscountKurus}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
              payableAmount={finalPayableAmount}
              paymentFee={codFee}
              shippingFee={shippingFee}
              isFreeShipping={isFreeShipping}
              promotionDiscountKurus={promotionDiscountKurus}
              promotionTitle={promotion.title}
              freeShippingTitle={promotion.freeShippingTitle}
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
                  onChange={(e) => setDraft({ ...draft, phone: formatPhoneInput(e.target.value) })}
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

          {/* 3. Ödeme Yöntemi */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                3. Ödeme Yöntemi
              </CardTitle>
            </CardHeader>
            <Separator />

            {paymentSettings === undefined ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Ödeme yöntemleri yükleniyor...
              </div>
            ) : !paymentSettings.paytr.enabled && !paymentSettings.bankTransfer.enabled && !paymentSettings.cashOnDelivery.enabled ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                Şu anda aktif bir ödeme yöntemi bulunmuyor. Lütfen mağaza yönetimiyle iletişime geçin.
              </div>
            ) : (
              <div className="space-y-3">
                {/* PayTR Seçeneği */}
                {paymentSettings.paytr.enabled && (
                  <div
                    className={`rounded-xl border p-4 transition cursor-pointer select-none ${effectivePaymentMethod === "paytr"
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40 bg-card"
                      }`}
                    onClick={() => setSelectedPaymentMethod("paytr")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCardIcon className="size-5 text-primary shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              Kredi / Banka Kartı (PayTR)
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              Demo
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {paymentSettings.paytr.description}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={effectivePaymentMethod === "paytr"}
                        onChange={() => setSelectedPaymentMethod("paytr")}
                        className="size-4 accent-primary cursor-pointer shrink-0"
                      />
                    </div>

                    {effectivePaymentMethod === "paytr" && (
                      <div
                        className="mt-4 pt-4 border-t border-border/80 space-y-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                          <span>
                            PayTR Demo Modu devrede. Kartınızdan herhangi bir ücret tahsil edilmez.
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={fillDemoCard}
                            className="h-7 text-xs bg-card hover:bg-muted font-medium shrink-0"
                          >
                            Demo Kart Bilgilerini Doldur
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <Label htmlFor="checkout-card-holder" className="text-xs font-medium">
                              Kart Üzerindeki İsim
                            </Label>
                            <Input
                              id="checkout-card-holder"
                              value={cardHolder}
                              onChange={(e) => setCardHolder(e.target.value)}
                              placeholder="Ad Soyad"
                              className="h-9 text-sm rounded-lg"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <Label htmlFor="checkout-card-number" className="text-xs font-medium">
                              Kart Numarası
                            </Label>
                            <Input
                              id="checkout-card-number"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value)}
                              placeholder="5423 4567 8901 2345"
                              maxLength={19}
                              className="h-9 text-sm font-mono rounded-lg"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="checkout-card-expiry" className="text-xs font-medium">
                              Son Kullanma (AA/YY)
                            </Label>
                            <Input
                              id="checkout-card-expiry"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="12/28"
                              maxLength={5}
                              className="h-9 text-sm font-mono rounded-lg"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="checkout-card-cvv" className="text-xs font-medium">
                              Güvenlik Kodu (CVV)
                            </Label>
                            <Input
                              id="checkout-card-cvv"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              placeholder="123"
                              maxLength={4}
                              className="h-9 text-sm font-mono rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Havale / EFT Seçeneği */}
                {paymentSettings.bankTransfer.enabled && (
                  <div
                    className={`rounded-xl border p-4 transition cursor-pointer select-none ${effectivePaymentMethod === "bank_transfer"
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40 bg-card"
                      }`}
                    onClick={() => setSelectedPaymentMethod("bank_transfer")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BanknotesIcon className="size-5 text-primary shrink-0" />
                        <div>
                          <span className="font-semibold text-sm text-foreground">
                            Havale / EFT ile Ödeme
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {paymentSettings.bankTransfer.description}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={effectivePaymentMethod === "bank_transfer"}
                        onChange={() => setSelectedPaymentMethod("bank_transfer")}
                        className="size-4 accent-primary cursor-pointer shrink-0"
                      />
                    </div>

                    {effectivePaymentMethod === "bank_transfer" && (
                      <div
                        className="mt-4 pt-4 border-t border-border/80 space-y-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-medium text-foreground">
                          Ödeme yapabileceğiniz banka hesapları:
                        </p>
                        <div className="space-y-2">
                          {paymentSettings.bankTransfer.accounts.map((acc) => (
                            <div
                              key={acc.id}
                              className="rounded-lg border border-border bg-background/80 p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                            >
                              <div>
                                <span className="font-semibold text-foreground">{acc.bankName}</span>
                                <span className="text-muted-foreground ml-2">({acc.accountHolder})</span>
                                <p className="font-mono text-muted-foreground text-[11px] mt-0.5 select-all">
                                  {acc.iban}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Sipariş onayından sonra sipariş numaranızı açıklama kısmına yazarak transferi tamamlayabilirsiniz.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Kapıda Ödeme Seçeneği */}
                {paymentSettings.cashOnDelivery.enabled && (
                  <div
                    className={`rounded-xl border p-4 transition cursor-pointer select-none ${effectivePaymentMethod === "cash_on_delivery"
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40 bg-card"
                      }`}
                    onClick={() => setSelectedPaymentMethod("cash_on_delivery")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TruckIcon className="size-5 text-primary shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              Kapıda Ödeme
                            </span>
                            {paymentSettings.cashOnDelivery.fee > 0 ? (
                              <Badge variant="outline" className="text-[10px]">
                                +{formatMoney(paymentSettings.cashOnDelivery.fee)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">
                                Ücretsiz
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {paymentSettings.cashOnDelivery.description}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={effectivePaymentMethod === "cash_on_delivery"}
                        onChange={() => setSelectedPaymentMethod("cash_on_delivery")}
                        className="size-4 accent-primary cursor-pointer shrink-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 4. Sipariş Onayı */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                4. Sipariş Onayı
              </CardTitle>
            </CardHeader>
            <Separator />

            <fieldset className="space-y-3">
              <legend className="sr-only">Sipariş sözleşmeleri</legend>
              {!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready ? (
                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  Satıcı bilgileri (ünvan, adres, e-posta, telefon) mağaza ayarlarında eksik olduğu için sözleşmeler henüz onaya hazır değil.
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
        <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-20">
          <Card className="rounded-2xl border-border bg-card p-6 shadow-sm space-y-4">
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
              couponDiscountKurus={couponDiscountKurus}
              couponPreview={couponPreview}
              appliedCouponCode={appliedCouponCode}
              payableAmount={finalPayableAmount}
              paymentFee={codFee}
              shippingFee={shippingFee}
              isFreeShipping={isFreeShipping}
              promotionDiscountKurus={promotionDiscountKurus}
              promotionTitle={promotion.title}
              freeShippingTitle={promotion.freeShippingTitle}
            />

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || !quotesReady}
              className="mt-4 w-full h-12 rounded-2xl shadow-lg font-semibold gap-2 cursor-pointer"
            >
              <SubmitButtonContent isSubmitting={isSubmitting} />
            </Button>
          </Card>
        </div>
      </form>

      {/* MOBİL SABİT ALT BUTON ÇUBUĞU */}
      <MobileSummaryBar
        label="Toplam Tutar"
        amount={formatMoney(finalPayableAmount)}
        hideFrom="lg"
      >
        <Button
          type="submit"
          form="checkout-form"
          size="lg"
          disabled={isSubmitting || !quotesReady}
          className={mobileSummaryActionClassName}
        >
          <SubmitButtonContent isSubmitting={isSubmitting} />
        </Button>
      </MobileSummaryBar>
    </div>
  );
}

function CheckoutContentWrapper() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "cart";
  return <CheckoutContent key={mode} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-screen-2xl px-4 py-20 text-center" aria-busy="true">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Sipariş sayfası açılıyor...</p>
        </div>
      }
    >
      <CheckoutContentWrapper />
    </Suspense>
  );
}
