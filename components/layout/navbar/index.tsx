import StoreInitial from "@/components/store-initial";
import { getMenu, getStoreSettings } from "@/lib/catalog";
import Link from "next/link";
import Image from "next/image";
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
    <>
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-neutral-50/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-1 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex min-w-0 max-w-[40%] items-center md:max-w-none md:gap-6 lg:gap-8">
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
                width={48}
                height={48}
                unoptimized
                className="size-9 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain sm:size-11 dark:border-neutral-700 dark:bg-black"
              />
            ) : (
              <span className="shrink-0 [&>span]:size-9 sm:[&>span]:size-11">
                <StoreInitial storeName={settings.storeName} />
              </span>
            )}
            <span className="truncate text-xs font-semibold tracking-wider uppercase text-black sm:text-sm dark:text-white">
              {settings.storeName}
            </span>
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

        {/* Orta: Arama Çubuğu (Masaüstü) */}
        <div className="hidden min-w-0 flex-1 max-w-md items-center md:flex md:gap-2">
          <div className="min-w-0 flex-1">
            <Suspense fallback={<SearchSkeleton />}>
              <Search variant="header" />
            </Suspense>
          </div>
        </div>

        {/* Sağ: Kullanıcı ve Sepet (Masaüstü) / Mobil Menü Butonu (Mobil) */}
        <div className="flex shrink-0 items-center justify-end gap-2.5">
          <div className="hidden md:flex md:items-center md:gap-2.5">
            <UserNav />
            <div className="hidden sm:block">
              <FavoritesLink />
            </div>
            <CartButton />
          </div>
          <div className="flex items-center md:hidden">
            <Suspense fallback={null}>
              <MobileMenu
                menu={menu}
                storeName={settings.storeName}
                logoUrl={settings.logoUrl}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </header>

    {/* Mobil Alt Yüzen Çubuk: Arama Çubuğu + Yüzen Sepet */}
    <div
      data-floating-bar
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-4 z-40 flex items-center justify-end gap-2.5 pointer-events-none md:hidden"
    >
      <div className="pointer-events-auto min-w-0 flex-1">
        <Suspense fallback={null}>
          <Search variant="floating" />
        </Suspense>
      </div>
      <div
        data-floating-cart
        className="pointer-events-auto shrink-0 rounded-full shadow-lg [&>a]:size-12 [&>a]:border-neutral-300 [&>a]:bg-white dark:[&>a]:border-neutral-700 dark:[&>a]:bg-neutral-900"
      >
        <CartButton floating />
      </div>
    </div>
    </>
  );
}
