"use client";

import { BanknotesIcon, CreditCardIcon, TruckIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format-money";
import type { PaymentMethod, PaymentSettings } from "./checkout-types";

export function CheckoutPaymentSection({
  paymentSettings,
  effectivePaymentMethod,
  setSelectedPaymentMethod,
  cardHolder,
  setCardHolder,
  cardNumber,
  setCardNumber,
  cardExpiry,
  setCardExpiry,
  cardCvv,
  setCardCvv,
  fillDemoCard,
}: {
  paymentSettings: PaymentSettings | undefined;
  effectivePaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
  cardHolder: string;
  setCardHolder: (value: string) => void;
  cardNumber: string;
  setCardNumber: (value: string) => void;
  cardExpiry: string;
  setCardExpiry: (value: string) => void;
  cardCvv: string;
  setCardCvv: (value: string) => void;
  fillDemoCard: () => void;
}) {
  return (
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
                  aria-label="Kredi / Banka Kartı (PayTR)"
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
                  aria-label="Havale / EFT ile Ödeme"
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
                  aria-label="Kapıda Ödeme"
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
  );
}
