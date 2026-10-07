"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckmarkBadge01Icon, Clock01Icon, LockIcon } from "hugeicons-react";
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
  const provider = searchParams.get("provider");
  const isSuccess = status === "success";
  const isReview = status === "review" || status === "pending";

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
          {isSuccess ? <CheckmarkBadge01Icon className="h-12 w-12" /> : <Clock01Icon className="h-10 w-10" />}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          {isSuccess ? "Ödemeniz Alındı" : isReview ? "Ödemeniz Kontrol Ediliyor" : "Ödeme Tamamlanamadı"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSuccess
            ? "Siparişiniz oluşturuldu. Sipariş bilgileri e-posta adresinize gönderilecek."
            : isReview
              ? "Ödeme sağlayıcısı sonucu doğruluyor. Aynı sipariş için tekrar ödeme yapmayın; sonuç e-posta ile bildirilecek."
              : "Ödeme onaylanmadı. Sepetiniz korunuyor; yeniden deneyebilir veya ürünleri daha sonra satın alabilirsiniz."}
        </p>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-left text-xs text-muted-foreground">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Kart bilgileri mağazada tutulmaz. Ödeme sonucu {provider === "paytr" ? "PayTR" : "iyzico"} callback’iyle sunucu tarafında doğrulanır.</span>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isAuthenticated && isSuccess ? (
            <Button asChild size="lg" className="flex-1 rounded-2xl font-semibold">
              <Link href="/account/orders">Siparişlerime Git</Link>
            </Button>
          ) : null}
          <Button asChild variant={isAuthenticated && isSuccess ? "outline" : "default"} size="lg" className="flex-1 rounded-2xl font-semibold">
            <Link href={isSuccess ? "/search" : "/checkout"}>{isSuccess ? "Alışverişe Devam Et" : "Ödemeye Dön"}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center text-sm text-muted-foreground">Ödeme sonucu yükleniyor...</div>}>
      <ResultContent />
    </Suspense>
  );
}
