"use client";

import { getOrderPriceBreakdown, getOrderPaymentMethodTitle } from "@/lib/orders";
import { formatMoney } from "@/lib/format-money";
import { Separator } from "@/components/ui/separator";

interface OrderPriceSummaryProps {
  order: {
    total: string | number;
    items: Array<{ price: string | number; quantity: number }>;
    shippingFee?: number | null;
    paymentFee?: number | null;
    couponCode?: string | null;
    couponDiscountKurus?: number | null;
    promotionDiscountKurus?: number | null;
    promotionTitle?: string | null;
    freeShippingPromotionTitle?: string | null;
    paymentMethod?: string | null;
    paymentMethodTitle?: string | null;
  };
  variant?: "admin" | "storefront";
  showPaymentMethod?: boolean;
  className?: string;
}

/**
 * Sipariş tutar dökümünü (Ara Toplam, Kupon, Kargo, Kapıda Ödeme Bedeli ve Genel Toplam)
 * tüm mağaza ve yönetici ekranlarında tek bir merkezden, tutarlı ve hatasız biçimde çizer.
 */
export function OrderPriceSummary({
  order,
  variant = "storefront",
  showPaymentMethod = true,
  className = "",
}: OrderPriceSummaryProps) {
  const breakdown = getOrderPriceBreakdown(order);
  const paymentMethodTitle = getOrderPaymentMethodTitle(order);
  const isAdmin = variant === "admin";

  const rowClass = isAdmin
    ? "flex items-center justify-between text-xs pb-2 border-b border-border/70"
    : "flex justify-between text-muted-foreground text-sm";

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {showPaymentMethod && (
        <div className={rowClass}>
          <span className="text-muted-foreground">Ödeme Yöntemi</span>
          <span className="font-semibold text-foreground">{paymentMethodTitle}</span>
        </div>
      )}

      <div className={rowClass}>
        <span className="text-muted-foreground">Ara Toplam</span>
        <span className="font-medium tabular-nums text-foreground">
          {formatMoney(breakdown.itemsSubtotal)}
        </span>
      </div>

      {order.couponCode && (
        <div
          className={
            isAdmin
              ? "flex items-center justify-between text-xs pb-2 border-b border-border/70"
              : "flex justify-between text-emerald-700 dark:text-emerald-400 font-medium text-sm"
          }
        >
          <span className={isAdmin ? "text-muted-foreground" : ""}>
            {isAdmin ? `İndirim Kuponu (${order.couponCode})` : `Kupon (${order.couponCode})`}
          </span>
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            −{formatMoney(breakdown.couponDiscount)}
          </span>
        </div>
      )}

      {breakdown.promotionDiscount > 0 && (
        <div
          className={
            isAdmin
              ? "flex items-center justify-between text-xs pb-2 border-b border-border/70"
              : "flex justify-between text-emerald-700 dark:text-emerald-400 font-medium text-sm"
          }
        >
          <span className={isAdmin ? "text-muted-foreground" : ""}>
            Kampanya{order.promotionTitle ? ` (${order.promotionTitle})` : ""}
          </span>
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            −{formatMoney(breakdown.promotionDiscount)}
          </span>
        </div>
      )}

      <div className={rowClass}>
        <span className="text-muted-foreground">Kargo</span>
        {breakdown.isFreeShipping ? (
          <span className="text-right font-medium text-emerald-700 dark:text-emerald-400">
            Ücretsiz{order.freeShippingPromotionTitle ? ` (${order.freeShippingPromotionTitle})` : ""}
          </span>
        ) : (
          <span className="font-medium tabular-nums text-foreground">
            +{formatMoney(breakdown.shippingFee)}
          </span>
        )}
      </div>

      {breakdown.paymentFee > 0 && (
        <div className={rowClass}>
          <span className="text-muted-foreground">Kapıda Ödeme Hizmet Bedeli</span>
          <span className="font-medium tabular-nums text-foreground">
            +{formatMoney(breakdown.paymentFee)}
          </span>
        </div>
      )}

      {isAdmin ? (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-foreground">Toplam Tutar</span>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {formatMoney(breakdown.total)}
          </span>
        </div>
      ) : (
        <>
          <Separator className="my-1.5" />
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-base font-bold text-foreground">Toplam Tutar</span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatMoney(breakdown.total)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
