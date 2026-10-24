import { CookieConsentManager, CookiePreferencesButton } from "@/components/privacy/cookie-consent-manager";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { MetaPixelProvider } from "@/components/analytics/meta-pixel-provider";
import { getStoreSettings } from "@/lib/catalog";
import { storeConfig } from "@/lib/store-config";
import { LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Güvenli Ödeme",
  robots: { index: false, follow: false },
};

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();

  if (!settings.isOpen) {
    return (
      <>
        <Suspense fallback={null}>
          <AnalyticsProvider />
          <MetaPixelProvider />
        </Suspense>
        <main className="mx-auto grid min-h-[100dvh] w-full max-w-xl place-items-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{storeConfig.name} şu anda kapalı</h1>
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
    <>
      <Suspense fallback={null}>
        <AnalyticsProvider />
        <MetaPixelProvider />
      </Suspense>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        İçeriğe geç
      </a>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        {/* Distraction-free Checkout Header */}
        <header className="sticky top-0 z-30 w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/"
              prefetch={true}
              aria-label={storeConfig.name}
              className="flex min-w-0 items-center gap-2.5 transition hover:opacity-90 sm:gap-3"
            >
              <Image
                src={storeConfig.logo}
                alt=""
                width={40}
                height={40}
                className="size-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain sm:size-9 dark:border-neutral-700"
              />
              <span className="truncate text-xs font-semibold tracking-wider uppercase text-black sm:text-sm dark:text-white">
                {storeConfig.name}
              </span>
            </Link>

            <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <ShieldCheckIcon className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Güvenli Ödeme</span>
              <LockClosedIcon className="size-3.5 text-neutral-400" aria-hidden="true" />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>{children}</main>
        <div className="mx-auto max-w-screen-2xl px-4 pb-6 text-center">
          <CookiePreferencesButton />
        </div>
      </div>
      <CookieConsentManager />
    </>
  );
}
