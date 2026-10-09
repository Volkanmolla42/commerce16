import StoreInitial from "@/components/store-initial";
import { getMenu, getStoreSettings } from "@/lib/catalog";
import { Menu } from "@/lib/catalog/types";
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-neutral-50/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-4 py-3.5">
        {/* Sol: Mobil Buton, Logo ve Menü */}
        <div className="flex items-center gap-6 lg:gap-8">
          <div className="block flex-none md:hidden">
            <Suspense fallback={null}>
              <MobileMenu menu={menu} />
            </Suspense>
          </div>

          <Link
            href="/"
            prefetch={true}
            className="flex items-center gap-2.5 transition hover:opacity-90"
          >
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt={settings.storeName} width={40} height={40} unoptimized className="h-10 w-10 rounded-xl border border-neutral-200 bg-white object-contain dark:border-neutral-700 dark:bg-black" />
            ) : (
              <StoreInitial storeName={settings.storeName} />
            )}
            <span className="text-sm font-semibold tracking-wider uppercase text-black dark:text-white">
              {settings.storeName}
            </span>
          </Link>

          {menu.length ? (
            <nav className="hidden md:flex md:items-center md:gap-6">
              <AllCategoriesMenu categories={menu.filter((item) => item.path !== "/search")} />
              {menu.filter((item) => item.path !== "/search").map((item: Menu) => (
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

        {/* Orta: Arama Çubuğu */}
        <div className="hidden flex-1 justify-center md:flex max-w-md">
          <Suspense fallback={<SearchSkeleton />}>
            <Search />
          </Suspense>
        </div>

        {/* Sağ: Kullanıcı ve Sepet */}
        <div className="flex items-center justify-end gap-2.5">
          <UserNav />
          <FavoritesLink />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
