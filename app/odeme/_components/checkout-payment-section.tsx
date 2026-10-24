"use client";

import { BanknotesIcon, TruckIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format-money";
import type { PaymentMethod, PaymentSettings } from "./checkout-types";

const optionClassName = (selected: boolean) =>
  `block rounded-xl border p-4 transition cursor-pointer select-none ${
    selected
      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
      : "border-border hover:border-muted-foreground/40 bg-card"
  }`;

export function CheckoutPaymentSection({
  paymentSettings,
  effectivePaymentMethod,
  setSelectedPaymentMethod,
}: {
  paymentSettings: PaymentSettings | undefined;
  effectivePaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
}) {
  const hasAvailableMethod = Boolean(
    paymentSettings?.bankTransfer.enabled || paymentSettings?.cashOnDelivery.enabled
  );

  return (
    <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <CardHeader className="p-0">
        <CardTitle role="heading" aria-level={2} className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          3. Ödeme Yöntemi
        </CardTitle>
      </CardHeader>
      <Separator />

      {paymentSettings === undefined ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Ödeme yöntemleri yükleniyor...
        </div>
      ) : !hasAvailableMethod ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          Şu anda aktif bir ödeme yöntemi bulunmuyor. Lütfen mağaza yönetimiyle iletişime geçin.
        </div>
      ) : (
        <fieldset className="space-y-3">
          <legend className="sr-only">Ödeme yöntemi seçin</legend>

          {paymentSettings.bankTransfer.enabled && (
            <label className={optionClassName(effectivePaymentMethod === "bank_transfer")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BanknotesIcon className="size-5 text-primary shrink-0" aria-hidden="true" />
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
                  value="bank_transfer"
                  checked={effectivePaymentMethod === "bank_transfer"}
                  onChange={() => setSelectedPaymentMethod("bank_transfer")}
                  className="size-4 accent-primary cursor-pointer shrink-0"
                />
              </div>

              {effectivePaymentMethod === "bank_transfer" && (
                <div className="mt-4 pt-4 border-t border-border/80 space-y-2.5">
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
            </label>
          )}

          {paymentSettings.cashOnDelivery.enabled && (
            <label className={optionClassName(effectivePaymentMethod === "cash_on_delivery")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TruckIcon className="size-5 text-primary shrink-0" aria-hidden="true" />
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
                        <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
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
                  value="cash_on_delivery"
                  checked={effectivePaymentMethod === "cash_on_delivery"}
                  onChange={() => setSelectedPaymentMethod("cash_on_delivery")}
                  className="size-4 accent-primary cursor-pointer shrink-0"
                />
              </div>
            </label>
          )}
        </fieldset>
      )}
    </Card>
  );
}
