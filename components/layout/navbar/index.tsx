import LogoSquare from "@/components/logo-square";
import { getMenu } from "@/lib/catalog";
import { Menu } from "@/lib/catalog/types";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Suspense } from "react";
import MobileMenu from "./mobile-menu";
import Search, { SearchSkeleton } from "./search";

const rawSiteName = process.env.SITE_NAME || "Commerce";
const SITE_NAME = rawSiteName.replace(/acme\s*/gi, "").trim() || "Commerce";

export async function Navbar() {
  const menu = await getMenu();

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
            <LogoSquare />
            <span className="text-sm font-semibold tracking-wider uppercase text-black dark:text-white">
              {SITE_NAME}
            </span>
          </Link>

          {menu.length ? (
            <nav className="hidden md:flex md:items-center md:gap-6">
              {menu.map((item: Menu) => (
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

        {/* Sağ: Sepet ve Eylemler */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            aria-label="Alışveriş Sepeti"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-white"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white dark:bg-white dark:text-black">
              0
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
