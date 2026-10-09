"use client";

import { useCart } from "@/components/cart/cart-context";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
import { clearCartRecoverySessionKey, getCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { getAnalyticsSessionIdForOrder, trackAnalyticsEvent } from "@/lib/analytics-client";
import { getProvinceById, TURKEY_PROVINCES } from "@/lib/turkey-provinces";
import { getProductUnitPrice } from "@/lib/catalog/variants";

function CheckoutContent() {
  const router = useRouter();
  const { items: cartItems, clearCart } = useCart();
  const isQuickBuy = useSearchParams().get("mode") === "quick-buy";
  const quickBuy = useQuickBuyDraft();
  const items = useMemo(
    () => isQuickBuy ? (quickBuy.item ? [quickBuy.item] : []) : cartItems,
    [cartItems, isQuickBuy, quickBuy.item],
  );
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalKurus = items.reduce((sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity, 0);
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
    appliedCouponCode ? { code: appliedCouponCode, subtotalKurus, now: couponCheckTime } : "skip",
  );
  const couponDiscountKurus = couponPreview?.valid ? couponPreview.discountKurus : 0;
  const payableKurus = Math.max(0, subtotalKurus - couponDiscountKurus);
  const shippingQuote = useQuery(api.settings.getCheckoutShippingQuote, { subtotalKurus: payableKurus });
  const shippingCostKurus = shippingQuote?.shippingCostKurus;
  const orderTotalKurus = payableKurus + (shippingCostKurus ?? 0);
  const payableAmount = orderTotalKurus / 100;
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
  const [invoiceRecipientType, setInvoiceRecipientType] = useState<"individual" | "business">("individual");
  const [businessTitle, setBusinessTitle] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [preInformationAccepted, setPreInformationAccepted] = useState(false);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);
  const [whatsappReminderConsent, setWhatsappReminderConsent] = useState(false);

  useEffect(() => {
    if (items.length > 0) void trackAnalyticsEvent("begin_checkout");
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) return;
    let sessionKey: string | null;
    try {
      sessionKey = getCartRecoverySessionKey(emailReminderConsent || whatsappReminderConsent);
    } catch {
      return;
    }
    if (!sessionKey) return;
    const timeout = window.setTimeout(() => {
      void captureRecovery({
        sessionKey,
        ...(emailReminderConsent ? { email: customerEmail } : {}),
        ...(whatsappReminderConsent ? { phone } : {}),
        emailConsent: emailReminderConsent,
        whatsappConsent: whatsappReminderConsent,
        items: emailReminderConsent || whatsappReminderConsent
          ? items.map((item) => ({
              productId: item.product.id,
              ...(item.variantId ? { variantId: item.variantId } : {}),
              quantity: item.quantity,
            }))
          : [],
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [captureRecovery, customerEmail, emailReminderConsent, items, phone, whatsappReminderConsent]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready) {
      setErrorMessage("Ödeme açılamıyor: yasal belgeler kodda tamamlanmalı.");
      setIsSubmitting(false);
      return;
    }
    if (!agreementAccepted || !preInformationAccepted) {
      setErrorMessage("Siparişten önce iki yasal belgeyi de okuyup onaylamalısınız.");
      setIsSubmitting(false);
      return;
    }

    if (!provinceId || !districtId) {
      setErrorMessage("Teslimat için geçerli bir il ve ilçe seçin.");
      setIsSubmitting(false);
      return;
    }
    if (appliedCouponCode && !couponPreview?.valid) {
      setErrorMessage(couponPreview && !couponPreview.valid ? couponPreview.message : "Kupon doğrulanıyor. Biraz bekleyip tekrar deneyin.");
      setIsSubmitting(false);
      return;
    }
    if (payableKurus <= 0) {
      setErrorMessage("Kupon indirimi sepet toplamını sıfırlıyor.");
      setIsSubmitting(false);
      return;
    }
    if (shippingQuote === undefined) {
      setErrorMessage("Kargo ücreti hesaplanıyor. Biraz bekleyip tekrar deneyin.");
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
        recoverySessionKey = getCartRecoverySessionKey(emailReminderConsent || whatsappReminderConsent);
      } catch {
        recoverySessionKey = null;
      }

      if (recoverySessionKey && items.length > 0) {
        await captureRecovery({
          sessionKey: recoverySessionKey,
          ...(emailReminderConsent ? { email: customerEmail } : {}),
          ...(whatsappReminderConsent ? { phone } : {}),
          emailConsent: emailReminderConsent,
          whatsappConsent: whatsappReminderConsent,
          items: emailReminderConsent || whatsappReminderConsent
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
          image: item.product.images[0],
        })),
        legalAcceptance: {
          accepted: true as const,
          distanceSalesAgreementVersion: legalDocuments.distanceSalesAgreement.version,
          preInformationFormVersion: legalDocuments.preInformationForm.version,
        },
        invoiceRecipient: invoiceRecipientType === "business"
          ? {
              type: "business" as const,
              businessTitle: businessTitle.trim(),
              taxNumber: taxNumber.trim(),
              taxOffice: taxOffice.trim(),
            }
          : { type: "individual" as const },
        saveAddress: saveAddressPayload,
      });

      if (recoverySessionKey && (emailReminderConsent || whatsappReminderConsent)) {
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
          <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
          <span>Güvenli Sipariş</span>
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

          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">Fatura bilgileri</CardTitle>
            </CardHeader>
            <Separator />
            <fieldset className="space-y-3">
              <legend className="text-xs text-muted-foreground">Fatura türü</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="invoice-recipient-type" checked={invoiceRecipientType === "individual"} onChange={() => setInvoiceRecipientType("individual")} className="h-4 w-4 accent-primary" />
                  Bireysel
                </label>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="invoice-recipient-type" checked={invoiceRecipientType === "business"} onChange={() => setInvoiceRecipientType("business")} className="h-4 w-4 accent-primary" />
                  Kurumsal
                </label>
              </div>
              {invoiceRecipientType === "business" && (
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="invoice-business-title">Ticaret unvanı</Label>
                    <Input id="invoice-business-title" autoComplete="organization" required maxLength={160} value={businessTitle} onChange={(event) => setBusinessTitle(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-tax-number">Vergi kimlik numarası</Label>
                    <Input id="invoice-tax-number" inputMode="numeric" autoComplete="off" required maxLength={10} pattern="[0-9]{10}" value={taxNumber} onChange={(event) => setTaxNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-tax-office">Vergi dairesi</Label>
                    <Input id="invoice-tax-office" autoComplete="off" required maxLength={100} value={taxOffice} onChange={(event) => setTaxOffice(event.target.value)} />
                  </div>
                </div>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Kurumsal fatura bilgileri sipariş kaydında ve yapılandırılmışsa fatura entegratörüne iletilir. <Link href="/privacy-policy" className="underline underline-offset-4">Gizlilik politikası</Link>
              </p>
            </fieldset>
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
                  <select
                    id="checkout-city"
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
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <option value="">İl seçin</option>
                    {TURKEY_PROVINCES.map((province) => (
                      <option key={province.id} value={province.id}>{province.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-district" className="text-xs uppercase tracking-wider text-muted-foreground">
                    İlçe
                  </Label>
                  <select
                    id="checkout-district"
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
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">İlçe seçin</option>
                    {[...districtOptions].sort((a, b) => a.name.localeCompare(b.name, "tr")).map((districtOption) => (
                      <option key={districtOption.id} value={districtOption.id}>{districtOption.name}</option>
                    ))}
                  </select>
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



          {(recoveryAvailability?.email || recoveryAvailability?.whatsapp) && (
            <Card className="rounded-3xl border-border bg-card p-6 shadow-xs">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Sepet hatırlatması (isteğe bağlı)</legend>
                <p className="text-xs text-muted-foreground">
                  Ödeme tamamlanmazsa seçtiğiniz her kanaldan bir hatırlatma gönderilir.
                </p>
                {recoveryAvailability.email && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
                    <input
                      id="cart-reminder-email-consent"
                      name="cart-reminder-email-consent"
                      type="checkbox"
                      checked={emailReminderConsent}
                      onChange={(event) => setEmailReminderConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>Sepetimdeki ürünleri tamamlamam için e-posta ile bir hatırlatma gönderilmesine izin veriyorum.</span>
                  </label>
                )}
                {recoveryAvailability.whatsapp && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
                    <input
                      id="cart-reminder-whatsapp-consent"
                      name="cart-reminder-whatsapp-consent"
                      type="checkbox"
                      checked={whatsappReminderConsent}
                      onChange={(event) => setWhatsappReminderConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>Sepetimdeki ürünleri tamamlamam için WhatsApp ile bir hatırlatma gönderilmesine izin veriyorum.</span>
                  </label>
                )}
              </fieldset>
            </Card>
          )}
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

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="checkout-coupon" className="text-xs font-medium text-foreground">İndirim kuponu</Label>
              <div className="flex gap-2">
                <Input
                  id="checkout-coupon"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setAppliedCouponCode(couponInput.trim().toLocaleUpperCase("en-US"));
                    }
                  }}
                  maxLength={32}
                  autoCapitalize="characters"
                  placeholder="Kupon kodu"
                  aria-describedby="checkout-coupon-status"
                  className="min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!couponInput.trim()}
                  onClick={() => setAppliedCouponCode(couponInput.trim().toLocaleUpperCase("en-US"))}
                >Uygula</Button>
              </div>
              <p
                id="checkout-coupon-status"
                role="status"
                aria-live="polite"
                className={`min-h-4 text-xs ${couponPreview?.valid ? "text-emerald-700 dark:text-emerald-400" : appliedCouponCode ? "text-destructive" : "text-muted-foreground"}`}
              >
                {couponPreview?.valid
                  ? `${couponPreview.code} kuponu uygulandı.`
                  : couponPreview && !couponPreview.valid
                    ? couponPreview.message
                    : appliedCouponCode ? "Kupon kontrol ediliyor…" : "Kupon kodunuz varsa burada uygulayın."}
              </p>
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
                {shippingQuote === undefined ? (
                  <span>Hesaplanıyor…</span>
                ) : shippingCostKurus === 0 ? (
                  <Badge variant="success">Ücretsiz</Badge>
                ) : (
                  <span>{formatMoney(shippingQuote.shippingCostKurus / 100)}</span>
                )}
              </div>
              {shippingQuote?.freeShippingRemainingKurus != null && shippingQuote.freeShippingRemainingKurus > 0 && shippingQuote.configuredShippingFeeKurus > 0 && (
                <p className="text-right text-xs text-muted-foreground">
                  {formatMoney(shippingQuote.freeShippingRemainingKurus / 100)} daha ekleyin, kargo ücretsiz olsun.
                </p>
              )}
              {couponDiscountKurus > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Kupon indirimi</span>
                  <span>−{formatMoney(couponDiscountKurus / 100)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold text-foreground pt-1">
                <span>Toplam</span>
                <span>{formatMoney(payableAmount)}</span>
              </div>
            </div>

            {/* Buton */}
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || shippingQuote === undefined}
              className="mt-6 w-full rounded-2xl shadow-lg font-semibold gap-2 h-14"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Sipariş İşleniyor...</span>
                </>
              ) : (
                <>
                  <CheckmarkBadge01Icon className="h-4 w-4" />
                  <span>Siparişi Tamamla ({formatMoney(payableAmount)})</span>
                </>
              )}
            </Button>

            <fieldset className="space-y-3 border-t border-border pt-4">
              <legend className="sr-only">Sipariş sözleşmeleri</legend>
              {!legalDocuments?.distanceSalesAgreement?.ready || !legalDocuments.preInformationForm?.ready ? (
                <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Ödeme için Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu içerikleri kodda tamamlanmalı.
                </p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                    <input type="checkbox" required checked={preInformationAccepted} onChange={(event) => setPreInformationAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                    <span><Link href={`/${legalDocuments.preInformationForm.slug}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">Ön Bilgilendirme Formu</Link> içeriğini ödeme öncesinde inceledim ve formu aldığımı onaylıyorum.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                    <input type="checkbox" required checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                    <span><Link href={`/${legalDocuments.distanceSalesAgreement.slug}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">Mesafeli Satış Sözleşmesi</Link> koşullarını okudum ve kabul ediyorum.</span>
                  </label>
                </>
              )}
            </fieldset>
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
