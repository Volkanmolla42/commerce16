import { getMenu, getStoreSettings } from "@/lib/catalog";
import Link from "next/link";
import { Suspense } from "react";
import MobileMenu from "./mobile-menu";
import { AllCategoriesMenu } from "./all-categories-menu";
import Search, { SearchSkeleton } from "./search";
import { UserNav } from "./user-nav";
import { CartButton } from "@/components/cart/cart-button";
import { FavoritesLink } from "@/components/favorites/favorites-link";

export async function Navbar() {
  const [menu, settings] = await Promise.all([getMenu(), getStoreSettings()]);
  const categories = menu.filter((item) => item.path !== "/search");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-3 py-2 sm:px-4 sm:py-3.5">
        {/* Sol: mobil menü + mağaza adı + masaüstü kategoriler */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none lg:gap-6">
          <Suspense fallback={null}>
            <MobileMenu menu={menu} storeName={settings.storeName} />
          </Suspense>

          <Link
            href="/"
            prefetch={true}
            aria-label={settings.storeName}
            className="min-w-0 truncate text-xs font-semibold tracking-wider uppercase text-black transition hover:opacity-90 sm:text-sm dark:text-white"
          >
            {settings.storeName}
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

        {/* Arama: mobilde alt satır, masaüstünde satır içi */}
        <div className="order-last w-full min-w-0 md:order-none md:w-auto md:max-w-md md:flex-1">
          <Suspense fallback={<SearchSkeleton />}>
            <Search />
          </Suspense>
        </div>

        {/* Sağ: profil, favoriler, sepet */}
        <div className="flex shrink-0 items-center gap-2.5">
          <UserNav />
          <div className="hidden sm:block">
            <FavoritesLink />
          </div>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
