"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckBadgeIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useCart } from "@/components/cart/cart-context";
import { clearQuickBuyItem } from "@/components/cart/quick-buy-store";
import { clearCartRecoverySessionKey } from "@/components/cart/recovery-store";
import { Button, Card } from "@/components/ui";

function ResultContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const { clearCart } = useCart();
  const status = searchParams.get("status");
  const isSuccess = status === "success";

  useEffect(() => {
    if (isSuccess) {
      clearCart();
      clearQuickBuyItem();
      try {
        clearCartRecoverySessionKey();
      } catch {
        // Cart clearing should still finish if browser storage is unavailable.
      }
    }
  }, [clearCart, isSuccess]);

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16 sm:py-24">
      <Card className="mx-auto max-w-lg rounded-3xl border-border bg-card p-8 text-center shadow-xl sm:p-12">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${isSuccess ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
          {isSuccess ? <CheckBadgeIcon className="h-12 w-12" /> : <ClockIcon className="h-10 w-10" />}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          {isSuccess ? "Siparişiniz Alındı" : "Sipariş Tamamlanamadı"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSuccess
            ? "Sipariş kaydınız oluşturuldu. Ödeme henüz alınmadı; siparişiniz ödeme bekliyor."
            : "Siparişiniz oluşturulamadı. Sepetiniz korunuyor; lütfen tekrar deneyin."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isAuthenticated && isSuccess ? (
            <Button asChild size="lg" className="flex-1 rounded-2xl font-semibold">
              <Link href="/account/orders">Siparişlerime Git</Link>
            </Button>
          ) : null}
          <Button asChild variant={isAuthenticated && isSuccess ? "outline" : "default"} size="lg" className="flex-1 rounded-2xl font-semibold">
            <Link href={isSuccess ? "/search" : "/checkout"}>{isSuccess ? "Alışverişe Devam Et" : "Sepete Dön"}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center text-sm text-muted-foreground">Sipariş sonucu yükleniyor...</div>}>
      <ResultContent />
    </Suspense>
  );
}
