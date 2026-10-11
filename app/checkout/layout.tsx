import { CartProvider } from "@/components/cart/cart-context";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import StoreInitial from "@/components/store-initial";
import { getStoreSettings } from "@/lib/catalog";
import { LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Güvenli Ödeme",
  robots: { index: false, follow: false },
};

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();

  if (!settings.isOpen) {
    return (
      <>
        <main className="mx-auto grid min-h-[100dvh] w-full max-w-xl place-items-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{settings.storeName} şu anda kapalı</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Kısa süre sonra yeniden hizmetinizdeyiz.
              {[settings.phone, settings.email].filter(Boolean).join(" · ") || null}
            </p>
          </div>
        </main>
        <CookieConsentManager />
      </>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        {/* Distraction-free Checkout Header */}
        <header className="sticky top-0 z-30 w-full border-b border-neutral-200/80 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/"
              prefetch={true}
              aria-label={settings.storeName}
              className="flex min-w-0 items-center gap-2.5 transition hover:opacity-90 sm:gap-3"
            >
              {settings.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  width={40}
                  height={40}
                  unoptimized
                  className="size-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain sm:size-9 dark:border-neutral-700 dark:bg-black"
                />
              ) : (
                <span className="shrink-0 [&>span]:size-8 sm:[&>span]:size-9">
                  <StoreInitial storeName={settings.storeName} />
                </span>
              )}
              <span className="truncate text-xs font-semibold tracking-wider uppercase text-black sm:text-sm dark:text-white">
                {settings.storeName}
              </span>
            </Link>

            <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline">256-Bit SSL ile</span>
              <span>Güvenli Ödeme</span>
              <LockClosedIcon className="size-3.5 text-neutral-400" aria-hidden="true" />
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
      <CookieConsentManager />
    </CartProvider>
  );
}
