import { CartProvider } from "@/components/cart/cart-context";
import { FavoritesProvider } from "@/components/favorites/favorites-context";
import { Navbar } from "@/components/layout/navbar";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { getStoreSettings } from "@/lib/catalog";
import type { ReactNode } from "react";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
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
    <>
      <div>
        <CartProvider>
          <FavoritesProvider>
            {settings.announcement && (
              <p className="w-full bg-neutral-900 px-4 py-2 text-center text-xs font-medium text-white dark:bg-neutral-100 dark:text-black">
                {settings.announcement}
              </p>
            )}
            <Navbar />
            <main>{children}</main>
          </FavoritesProvider>
        </CartProvider>
      </div>
      <CookieConsentManager />
    </>
  );
}
