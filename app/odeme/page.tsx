"use client";

import { routes } from "@/lib/storefront-routes";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import { ArrowTopRightOnSquareIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MobileSummaryBar, mobileSummaryActionClassName } from "@/components/layout/mobile-summary-bar";
import { formatMoney } from "@/lib/format-money";
import { getShippingQuote } from "@/lib/shipping";
import { getCheckoutDetails, type CheckoutDraft } from "./checkout-details";
import { useCart } from "@/components/cart/cart-context";
import { useQuickBuyItem } from "@/components/cart/quick-buy-store";
import { getCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { getAnalyticsSessionIdForOrder, trackAnalyticsEvent } from "@/lib/analytics-client";
import { trackPixelInitiateCheckout } from "@/lib/analytics/meta-pixel";
import { getDistrictById, getProvinceById } from "@/lib/turkey-provinces";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { quotePromotions } from "@/lib/promotions";
import { isValidTaxNumber } from "@/lib/orders";
import { TERMS_VERSION } from "@/lib/legal-documents";
import { CheckoutAddressSection } from "./_components/checkout-address-section";
import { CheckoutContactSection } from "./_components/checkout-contact-section";
import { CheckoutInvoiceSection } from "./_components/checkout-invoice-section";
import { CheckoutPaymentSection } from "./_components/checkout-payment-section";
import { CheckoutDesktopSummary, CheckoutMobileSummary, SubmitButtonContent } from "./_components/checkout-summary";
import type { PaymentMethod } from "./_components/checkout-types";

function CheckoutContent() {
  const router = useRouter();
  const { items: cartItems } = useCart();
  const isQuickBuy = useSearchParams().get("mode") === "quick-buy";
  const quickBuyItem = useQuickBuyItem();
  const items = isQuickBuy ? (quickBuyItem ? [quickBuyItem] : []) : cartItems;
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  const itemsKey = items.map((item) => `${item.product.id}:${item.variantId ?? ""}:${item.quantity}`).join(",");
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  const effectivePaymentMethod = selectedPaymentMethod ?? (
    paymentSettings?.bankTransfer.enabled
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
  const shipping = getShippingQuote({
    subtotal: subtotalKurus / 100,
    freeShippingThreshold,
    shippingFee: standardShippingFee,
    promotionFreeShipping: promotion.freeShipping,
  });
  const shippingFee = shipping.shippingFee;
  const shippingFeeKurus = Math.round(shippingFee * 100);

  const finalPayableKurus = discountedPayableKurus + codFeeKurus + shippingFeeKurus;
  const finalPayableAmount = finalPayableKurus / 100;

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

  // Fatura & Kurumsal Durumu
  const [billingType, setBillingType] = useState<"individual" | "corporate">("individual");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [sameAsShippingAddress, setSameAsShippingAddress] = useState(true);
  const [billingAddressSelection, setBillingAddressSelection] = useState<string | null>(null);
  const [billingAddressLine, setBillingAddressLine] = useState("");
  const [billingProvinceId, setBillingProvinceId] = useState("");
  const [billingDistrictId, setBillingDistrictId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [preInformationAccepted, setPreInformationAccepted] = useState(false);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);

  useEffect(() => {
    if (!errorMessage) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorMessage]);

  const hasTrackedCheckoutRef = useRef(false);

  useEffect(() => {
    const currentItems = itemsRef.current;
    if (currentItems.length > 0 && !hasTrackedCheckoutRef.current) {
      hasTrackedCheckoutRef.current = true;
      void trackAnalyticsEvent("begin_checkout");
      trackPixelInitiateCheckout({
        value: finalPayableAmount,
        currency: "TRY",
        num_items: currentItems.reduce((acc, item) => acc + item.quantity, 0),
        content_ids: currentItems.map((item) => (item.variantId ? `${item.product.id}_${item.variantId}` : item.product.id)),
      });
    }
  }, [finalPayableAmount, itemsKey]);

  useEffect(() => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0 || !emailReminderConsent) return;
    let sessionKey: string | null;
    try {
      sessionKey = getCartRecoverySessionKey(true);
    } catch {
      return;
    }
    if (!sessionKey) return;
    const timeout = window.setTimeout(() => {
      void captureRecovery({
        sessionKey,
        email: customerEmail,
        emailConsent: true,
        items: currentItems.map((item) => ({
          productId: item.product.id,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
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
      setErrorMessage("Sözleşmeler onaya hazır değil: satıcı unvanı, adresi, vergi bilgileri ve iletişim bilgileri eksik.");
      setIsSubmitting(false);
      return;
    }
    if (!preInformationAccepted || !agreementAccepted || !termsAccepted) {
      setErrorMessage("Sipariş vermeden önce Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi ve Kullanım Koşulları'nı onaylamalısınız.");
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

    if (billingType === "corporate") {
      if (!companyName.trim()) {
        setErrorMessage("Kurumsal fatura için firma resmi unvanı zorunludur.");
        setIsSubmitting(false);
        return;
      }
      if (!taxNumber.trim() || !isValidTaxNumber(taxNumber.trim())) {
        setErrorMessage("Lütfen geçerli bir Vergi Kimlik Numarası (10 hane) veya şahıs şirketi için TCKN (11 hane) girin.");
        setIsSubmitting(false);
        return;
      }
      if (!taxOffice.trim()) {
        setErrorMessage("Kurumsal fatura için vergi dairesi zorunludur.");
        setIsSubmitting(false);
        return;
      }
    }

    const fullShippingAddress = `${customerName}, Tel: ${phone} - ${addressLine}, ${district}/${city}`;

    let fullBillingAddress = fullShippingAddress;
    if (!sameAsShippingAddress) {
      if (billingAddressSelection && billingAddressSelection !== "custom") {
        const selectedBilling = addresses?.find((a) => a._id === billingAddressSelection);
        if (selectedBilling) {
          fullBillingAddress = `${customerName}, Tel: ${phone} - ${selectedBilling.addressLine1}, ${selectedBilling.district}/${selectedBilling.city}`;
        }
      } else {
        if (!billingProvinceId || !billingDistrictId) {
          setErrorMessage("Fatura adresi için lütfen geçerli bir il ve ilçe seçin.");
          setIsSubmitting(false);
          return;
        }
        if (!billingAddressLine.trim()) {
          setErrorMessage("Lütfen açık fatura adresini girin.");
          setIsSubmitting(false);
          return;
        }
        const billingProvince = getProvinceById(billingProvinceId);
        const billingDistrict = getDistrictById(billingProvinceId, billingDistrictId);
        fullBillingAddress = `${billingAddressLine.trim()}, ${billingDistrict?.name ?? ""}/${billingProvince?.name ?? ""}`;
      }
    }
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
      const { orderId, accessToken } = await createOrder({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phone.trim() || undefined,
        ...(analyticsSessionId ? { analyticsSessionId } : {}),
        shippingAddress: fullShippingAddress,
        billingType,
        ...(billingType === "corporate" ? {
          companyName: companyName.trim(),
          taxNumber: taxNumber.trim(),
          taxOffice: taxOffice.trim(),
        } : {}),
        billingAddress: fullBillingAddress,
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
          termsVersion: TERMS_VERSION,
        },
      });

      if (recoverySessionKey && emailReminderConsent) {
        await linkRecoveryOrder({ sessionKey: recoverySessionKey, orderId }).catch(() => undefined);
      }

      router.replace(`${routes.checkoutSuccess(orderId)}?token=${encodeURIComponent(accessToken)}${isQuickBuy ? "&mode=quick-buy" : ""}`);
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
            <Link href={isQuickBuy ? routes.search : routes.cart}>
              <span>{isQuickBuy ? "Alışverişe Devam Et" : "Sepete Dön"}</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-8 pb-28 sm:pb-12">
      <h1 className="sr-only">Siparişi Tamamla</h1>
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
          <CheckoutMobileSummary
            items={items}
            totalCount={totalCount}
            couponInput={couponInput}
            setCouponInput={setCouponInput}
            handleApplyCoupon={handleApplyCoupon}
            couponPreview={couponPreview}
            appliedCouponCode={appliedCouponCode}
            couponDiscountKurus={couponDiscountKurus}
            payableAmount={finalPayableAmount}
            paymentFee={codFee}
            shippingFee={shippingFee}
            isFreeShipping={shipping.freeShipping}
            promotionDiscountKurus={promotionDiscountKurus}
            promotionTitle={promotion.title}
            freeShippingTitle={promotion.freeShippingTitle}
          />

          <CheckoutContactSection
            customerName={customerName}
            customerEmail={customerEmail}
            phone={phone}
            draft={draft}
            setDraft={setDraft}
          />

          <CheckoutAddressSection
            isAuthenticated={isAuthenticated}
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            handleAddressSelect={handleAddressSelect}
            draft={draft}
            setDraft={setDraft}
            addressTitle={addressTitle}
            setAddressTitle={setAddressTitle}
            saveAddressToBook={saveAddressToBook}
            setSaveAddressToBook={setSaveAddressToBook}
            provinceId={provinceId}
            districtId={districtId}
            city={city}
            district={district}
            addressLine={addressLine}
            setAddressSelection={setAddressSelection}
          >
            <CheckoutInvoiceSection
              isAuthenticated={isAuthenticated}
              addresses={addresses}
              billingType={billingType}
              setBillingType={setBillingType}
              companyName={companyName}
              setCompanyName={setCompanyName}
              taxOffice={taxOffice}
              setTaxOffice={setTaxOffice}
              taxNumber={taxNumber}
              setTaxNumber={setTaxNumber}
              sameAsShippingAddress={sameAsShippingAddress}
              setSameAsShippingAddress={setSameAsShippingAddress}
              billingAddressSelection={billingAddressSelection}
              setBillingAddressSelection={setBillingAddressSelection}
              billingAddressLine={billingAddressLine}
              setBillingAddressLine={setBillingAddressLine}
              billingProvinceId={billingProvinceId}
              setBillingProvinceId={setBillingProvinceId}
              billingDistrictId={billingDistrictId}
              setBillingDistrictId={setBillingDistrictId}
            />
          </CheckoutAddressSection>

          <CheckoutPaymentSection
            paymentSettings={paymentSettings}
            effectivePaymentMethod={effectivePaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
          />

          {/* 4. Sipariş Onayı */}
          <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle role="heading" aria-level={2} className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
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
                        <ArrowTopRightOnSquareIcon className="size-3 inline" aria-hidden="true" />
                        <span className="sr-only"> (yeni sekmede açılır)</span>
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
                        <ArrowTopRightOnSquareIcon className="size-3 inline" aria-hidden="true" />
                        <span className="sr-only"> (yeni sekmede açılır)</span>
                      </Link>{" "}
                      koşullarını okudum ve kabul ediyorum.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition cursor-pointer select-none">
                    <input
                      type="checkbox"
                      required
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary rounded cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <Link
                        href={routes.termsConditions}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-foreground underline underline-offset-2 hover:text-primary inline-flex items-center gap-0.5"
                      >
                        <span>Kullanım Koşulları</span>
                        <ArrowTopRightOnSquareIcon className="size-3 inline" aria-hidden="true" />
                        <span className="sr-only"> (yeni sekmede açılır)</span>
                      </Link>{" "}
                      metnini okudum ve kabul ediyorum.
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

              <p className="px-1 text-[11px] leading-4 text-muted-foreground">
                Kişisel verileriniz siparişin oluşturulması ve teslimatı için{" "}
                <Link href={routes.privacyPolicy} className="underline underline-offset-2 hover:text-foreground">
                  Gizlilik Politikası
                </Link>{" "}
                ve{" "}
                <Link href={routes.cookiePolicy} className="underline underline-offset-2 hover:text-foreground">
                  Çerez Politikası
                </Link>{" "}
                kapsamında işlenir. İade koşulları için{" "}
                <Link href={routes.refundPolicy} className="underline underline-offset-2 hover:text-foreground">
                  İade ve Cayma Hakkı Politikası
                </Link>{" "}
                geçerlidir.
              </p>
            </fieldset>
          </Card>
        </div>

        {/* Sağ Kolon: Masaüstü Sipariş Özeti */}
        <CheckoutDesktopSummary
          items={items}
          totalCount={totalCount}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          handleApplyCoupon={handleApplyCoupon}
          couponPreview={couponPreview}
          appliedCouponCode={appliedCouponCode}
          couponDiscountKurus={couponDiscountKurus}
          payableAmount={finalPayableAmount}
          paymentFee={codFee}
          shippingFee={shippingFee}
          isFreeShipping={shipping.freeShipping}
          promotionDiscountKurus={promotionDiscountKurus}
          promotionTitle={promotion.title}
          freeShippingTitle={promotion.freeShippingTitle}
          isSubmitting={isSubmitting}
          quotesReady={quotesReady}
        />
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
