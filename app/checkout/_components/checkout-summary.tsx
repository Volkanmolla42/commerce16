"use client";

import Image from "next/image";
import { LockClosedIcon, ShoppingBagIcon, TagIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CartItem } from "@/components/cart/cart-store";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { formatMoney } from "@/lib/format-money";
import type { CouponPreview } from "./checkout-types";

type CheckoutSummaryProps = {
  items: CartItem[];
  totalCount: number;
  couponInput: string;
  setCouponInput: (value: string) => void;
  handleApplyCoupon: () => void;
  couponPreview: CouponPreview;
  appliedCouponCode: string;
  couponDiscountKurus: number;
  payableAmount: number;
  paymentFee: number;
  shippingFee: number;
  isFreeShipping: boolean;
  promotionDiscountKurus: number;
  promotionTitle: string | null;
  freeShippingTitle: string | null;
};

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
  idPrefix,
  couponInput,
  setCouponInput,
  handleApplyCoupon,
  couponPreview,
  appliedCouponCode,
}: {
  idPrefix: string;
  couponInput: string;
  setCouponInput: (value: string) => void;
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

export function SubmitButtonContent({ isSubmitting }: { isSubmitting: boolean }) {
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

function SummaryBody({ idPrefix, ...props }: CheckoutSummaryProps & { idPrefix: string }) {
  return (
    <>
      <Separator />

      <OrderItemsList items={props.items} />

      <Separator />

      <CouponSection
        idPrefix={idPrefix}
        couponInput={props.couponInput}
        setCouponInput={props.setCouponInput}
        handleApplyCoupon={props.handleApplyCoupon}
        couponPreview={props.couponPreview}
        appliedCouponCode={props.appliedCouponCode}
      />

      <Separator />

      <PriceSummaryRows
        couponDiscountKurus={props.couponDiscountKurus}
        couponPreview={props.couponPreview}
        appliedCouponCode={props.appliedCouponCode}
        payableAmount={props.payableAmount}
        paymentFee={props.paymentFee}
        shippingFee={props.shippingFee}
        isFreeShipping={props.isFreeShipping}
        promotionDiscountKurus={props.promotionDiscountKurus}
        promotionTitle={props.promotionTitle}
        freeShippingTitle={props.freeShippingTitle}
      />
    </>
  );
}

export function CheckoutMobileSummary(props: CheckoutSummaryProps) {
  return (
    <Card className="rounded-2xl border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 lg:hidden">
      <div className="flex items-center gap-2">
        <ShoppingBagIcon className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Sipariş Özeti ({props.totalCount} Ürün)
        </span>
      </div>

      <SummaryBody {...props} idPrefix="mobile" />
    </Card>
  );
}

export function CheckoutDesktopSummary(
  props: CheckoutSummaryProps & { isSubmitting: boolean; quotesReady: boolean },
) {
  return (
    <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-20">
      <Card className="rounded-2xl border-border bg-card p-6 shadow-sm space-y-4">
        <CardHeader className="p-0">
          <CardTitle className="text-base font-semibold text-foreground">
            Sipariş Özeti ({props.totalCount} Ürün)
          </CardTitle>
        </CardHeader>

        <SummaryBody {...props} idPrefix="desktop" />

        <Button
          type="submit"
          size="lg"
          disabled={props.isSubmitting || !props.quotesReady}
          className="mt-4 w-full h-12 rounded-2xl shadow-lg font-semibold gap-2 cursor-pointer"
        >
          <SubmitButtonContent isSubmitting={props.isSubmitting} />
        </Button>
      </Card>
    </div>
  );
}
