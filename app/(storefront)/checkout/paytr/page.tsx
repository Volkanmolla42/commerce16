"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function PaytrFrame() {
  const token = useSearchParams().get("token");
  if (!token || !/^[A-Za-z0-9_-]{24,128}$/.test(token)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-sm text-destructive">Ödeme formu bağlantısı geçersiz.</p>
        <Link href="/checkout" className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">Ödemeye dön</Link>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
      <h1 className="mb-4 text-lg font-semibold text-foreground">Güvenli ödeme</h1>
      <iframe
        title="PayTR güvenli ödeme formu"
        src={`https://www.paytr.com/odeme/guvenli/${token}`}
        referrerPolicy="no-referrer"
        className="h-[min(82dvh,900px)] min-h-[620px] w-full rounded-xl border border-border bg-white"
      />
    </main>
  );
}

export default function PaytrCheckoutPage() {
  return <Suspense fallback={<div className="px-4 py-20 text-center text-sm text-muted-foreground">Güvenli ödeme formu yükleniyor…</div>}><PaytrFrame /></Suspense>;
}
