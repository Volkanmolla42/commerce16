import { FavoritesProvider } from "@/components/favorites/favorites-context";
import { Navbar, NavbarFallback } from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { MetaPixelProvider } from "@/components/analytics/meta-pixel-provider";
import { getStoreSettings } from "@/lib/catalog";
import { Suspense, type ReactNode } from "react";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
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
          <Suspense fallback={null}>
            <StoreAnnouncement />
          </Suspense>
          <Suspense fallback={<NavbarFallback />}>
            <Navbar />
          </Suspense>
          <main id="main-content" tabIndex={-1} className="flex-1 min-h-dvh">
            {children}
          </main>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </FavoritesProvider>
      </div>
      <CookieConsentManager />
    </>
  );
}

async function StoreAnnouncement() {
  const { announcement } = await getStoreSettings();
  if (!announcement) return null;

  return (
    <p className="w-full bg-neutral-900 px-4 py-2 text-center text-xs font-medium text-white dark:bg-neutral-100 dark:text-black">
      {announcement}
    </p>
  );
}
