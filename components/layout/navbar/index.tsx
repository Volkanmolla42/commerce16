import { routes } from "@/lib/storefront-routes";
import { getCategories, getMenu } from "@/lib/catalog";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { storeConfig } from "@/lib/store-config";
import MobileMenu from "./mobile-menu";
import { AllCategoriesMenu } from "./all-categories-menu";
import { HeaderSearch, HeaderSearchFallback } from "./header-search";
import { UserNav } from "./user-nav";
import { CartButton } from "@/components/cart/cart-button";
import { FavoritesLink } from "@/components/favorites/favorites-link";

export async function Navbar() {
  const [menu, categoryList] = await Promise.all([
    getMenu(),
    getCategories(),
  ]);
  const categories = menu.filter((item) => item.path !== routes.search);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-3 py-2 sm:px-4 sm:py-3.5">
        {/* Sol: mobil menü + mağaza adı + masaüstü kategoriler */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none lg:gap-6">
          <Suspense fallback={null}>
            <MobileMenu categories={categoryList} />
          </Suspense>

          <Link
            href="/"
            prefetch={true}
            aria-label={storeConfig.name}
            className="flex min-w-0 items-center gap-2.5 text-xs font-semibold tracking-wider uppercase text-black transition hover:opacity-90 sm:text-sm dark:text-white"
          >
            <span className="hidden md:flex shrink-0 items-center">
              <Image
                src={storeConfig.logo}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700"
              />
            </span>
            <span className="truncate">{storeConfig.name}</span>
          </Link>

          {categories.length ? (
            <nav aria-label="Ana menü" className="hidden lg:flex lg:items-center lg:gap-6">
              <AllCategoriesMenu categories={categories} />
              {categories.slice(0, 5).map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  prefetch={true}
                  className="text-sm font-medium text-neutral-600 transition hover:text-black dark:text-neutral-400 dark:hover:text-white whitespace-nowrap"
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

export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-3 py-2 sm:px-4 sm:py-3.5">
        <Link
          href="/"
          aria-label={storeConfig.name}
          className="flex min-w-0 items-center gap-2.5 text-xs font-semibold tracking-wider uppercase text-black sm:text-sm dark:text-white"
        >
          <span className="hidden shrink-0 items-center md:flex">
            <Image
              src={storeConfig.logo}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700"
            />
          </span>
          <span className="truncate">{storeConfig.name}</span>
        </Link>
        <HeaderSearchFallback />
        <div className="flex min-h-10 shrink-0 items-center gap-2.5">
          <UserNav />
          <FavoritesLink />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
