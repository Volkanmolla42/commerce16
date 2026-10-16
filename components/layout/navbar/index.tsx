import { getCategories, getMenu, getStoreSettings } from "@/lib/catalog";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import StoreInitial from "@/components/store-initial";
import MobileMenu from "./mobile-menu";
import { AllCategoriesMenu } from "./all-categories-menu";
import { HeaderSearch, HeaderSearchFallback } from "./header-search";
import { UserNav } from "./user-nav";
import { CartButton } from "@/components/cart/cart-button";
import { FavoritesLink } from "@/components/favorites/favorites-link";

export async function Navbar() {
  const [menu, categoryList, settings] = await Promise.all([
    getMenu(),
    getCategories(),
    getStoreSettings(),
  ]);
  const categories = menu.filter((item) => item.path !== "/search");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-3 py-2 sm:px-4 sm:py-3.5">
        {/* Sol: mobil menü + mağaza adı + masaüstü kategoriler */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none lg:gap-6">
          <Suspense fallback={null}>
            <MobileMenu
              categories={categoryList}
              storeName={settings.storeName}
              logoUrl={settings.logoUrl}
            />
          </Suspense>

          <Link
            href="/"
            prefetch={true}
            aria-label={settings.storeName}
            className="flex min-w-0 items-center gap-2.5 text-xs font-semibold tracking-wider uppercase text-black transition hover:opacity-90 sm:text-sm dark:text-white"
          >
            <span className="hidden md:flex shrink-0 items-center">
              {settings.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700 dark:bg-neutral-950"
                />
              ) : (
                <StoreInitial storeName={settings.storeName} size="sm" />
              )}
            </span>
            <span className="truncate">{settings.storeName}</span>
          </Link>

          {categories.length ? (
            <nav className="hidden lg:flex lg:items-center lg:gap-6">
              <AllCategoriesMenu categories={categories} />
              {categories.map((item) => (
                <Link
                  key={item.title}
                  href={item.path}
                  prefetch={true}
                  className="text-sm font-medium text-neutral-600 transition hover:text-black dark:text-neutral-400 dark:hover:text-white"
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {/* Arama: mobilde alt satır (yalnızca ana sayfa + arama sayfalarında), masaüstünde satır içi */}
        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearch />
        </Suspense>

        {/* Sağ: profil, favoriler, sepet */}
        <div className="flex shrink-0 items-center gap-2.5">
          <UserNav />
          <FavoritesLink />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
