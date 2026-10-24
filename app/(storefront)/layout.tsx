import { FavoritesProvider } from "@/components/favorites/favorites-context";
import { Navbar } from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { MetaPixelProvider } from "@/components/analytics/meta-pixel-provider";
import { getStoreSettings } from "@/lib/catalog";
import { storeConfig } from "@/lib/store-config";
import { Suspense, type ReactNode } from "react";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
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
      <div className="flex flex-col">
        <FavoritesProvider>
          {settings.announcement && (
            <p className="w-full bg-neutral-900 px-4 py-2 text-center text-xs font-medium text-white dark:bg-neutral-100 dark:text-black">
              {settings.announcement}
            </p>
          )}
          <Navbar />
          <main id="main-content" tabIndex={-1} className="flex-1 min-h-dvh">{children}</main>
          <Footer />
        </FavoritesProvider>
      </div>
      <CookieConsentManager />
    </>
  );
}
