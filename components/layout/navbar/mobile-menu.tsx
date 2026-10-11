"use client";

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import {
  Bars3Icon,
  ChevronRightIcon,
  HeartIcon,
  HomeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Squares2X2Icon,
  TagIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useFavorites } from "@/components/favorites/favorites-context";
import { useCart } from "@/components/cart/cart-context";
import type { Menu } from "@/lib/catalog/types";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function getMenuItemIcon(item: Menu) {
  const normalizedTitle = item.title.trim().toLowerCase();
  const normalizedPath = item.path.trim().toLowerCase();

  if (normalizedPath === "/search" || normalizedTitle === "tüm ürünler") {
    return Squares2X2Icon;
  }
  if (normalizedTitle.includes("yeni") || normalizedTitle.includes("fırsat") || normalizedTitle.includes("popüler")) {
    return SparklesIcon;
  }
  return TagIcon;
}

export default function MobileMenu({
  menu,
  storeName = "Mağaza",
}: {
  menu: Menu[];
  storeName?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const openMobileMenu = () => setIsOpen(true);
  const closeMobileMenu = () => setIsOpen(false);

  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : "skip",
  );

  const { favoriteSlugs, isReady: favoritesReady } = useFavorites();
  const { totalCount: cartCount } = useCart();
  const favoritesCount = favoritesReady ? favoriteSlugs.length : 0;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const [prevUrl, setPrevUrl] = useState(currentUrl);
  if (currentUrl !== prevUrl) {
    setPrevUrl(currentUrl);
    setIsOpen(false);
  }

  const userName = profile?.name?.trim() || profile?.email?.trim() || "Hesabım";

  const hasHomeLink = menu.some(
    (item) => item.path === "/" || item.title.trim().toLowerCase() === "ana sayfa",
  );

  return (
    <>
      <button
        onClick={openMobileMenu}
        aria-label="Mobil menüyü aç"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
      </button>
      <Transition show={isOpen}>
        <Dialog onClose={closeMobileMenu} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="transition-opacity ease-out duration-150 motion-reduce:transition-none"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-100 motion-reduce:transition-none"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </TransitionChild>
          <TransitionChild
            as={Fragment}
            enter="transition-transform ease-out duration-200 motion-reduce:transition-none"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition-transform ease-in duration-150 motion-reduce:transition-none"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="fixed inset-y-0 left-0 flex h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col bg-white shadow-xl dark:bg-black">
              {/* Üst Kısım: Mağaza Adı ve Kapatma Butonu */}
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
                <Link
                  href="/"
                  prefetch={true}
                  onClick={closeMobileMenu}
                  className="min-w-0 truncate text-xs font-semibold tracking-wider uppercase text-neutral-900 transition hover:opacity-85 dark:text-white"
                >
                  <DialogTitle className="truncate">{storeName}</DialogTitle>
                </Link>
                <button
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  onClick={closeMobileMenu}
                  aria-label="Menüyü kapat"
                >
                  <XMarkIcon className="size-5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <nav aria-label="Kategoriler ve sayfalar">
                  <ul className="flex w-full flex-col gap-1">
                    {!hasHomeLink ? (
                      <li>
                        <Link
                          href="/"
                          prefetch={true}
                          onClick={closeMobileMenu}
                          className="group flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                        >
                          <span className="flex items-center gap-3">
                            <HomeIcon
                              className="size-5 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                              aria-hidden="true"
                            />
                            <span>Ana Sayfa</span>
                          </span>
                          <ChevronRightIcon
                            className="size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ) : null}

                    {menu.map((item: Menu) => {
                      const Icon = getMenuItemIcon(item);
                      return (
                        <li key={item.title}>
                          <Link
                            href={item.path}
                            prefetch={true}
                            onClick={closeMobileMenu}
                            className="group flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                          >
                            <span className="flex items-center gap-3">
                              <Icon
                                className="size-5 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                                aria-hidden="true"
                              />
                              <span>{item.title}</span>
                            </span>
                            <ChevronRightIcon
                              className="size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <ul className="flex flex-col gap-1">
                    <li>
                      <Link
                        href={isAuthenticated ? "/account/orders" : "/login"}
                        onClick={closeMobileMenu}
                        className="group flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <UserIcon
                            className="size-5 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                            aria-hidden="true"
                          />
                          <span className="truncate">{isAuthenticated ? userName : "Giriş Yap"}</span>
                        </span>
                        <ChevronRightIcon
                          className="size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>

                    <li>
                      <Link
                        href="/account/favorites"
                        onClick={closeMobileMenu}
                        className="group flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                      >
                        <span className="flex items-center gap-3">
                          <HeartIcon
                            className="size-5 shrink-0 text-neutral-500 transition-colors group-hover:text-rose-600 dark:text-neutral-400 dark:group-hover:text-rose-400"
                            aria-hidden="true"
                          />
                          <span>Favorilerim</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {favoritesCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                              {favoritesCount > 99 ? "99+" : favoritesCount}
                            </span>
                          ) : null}
                          <ChevronRightIcon
                            className="size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                            aria-hidden="true"
                          />
                        </div>
                      </Link>
                    </li>

                    <li>
                      <Link
                        href="/cart"
                        onClick={closeMobileMenu}
                        className="group flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                      >
                        <span className="flex items-center gap-3">
                          <ShoppingBagIcon
                            className="size-5 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                            aria-hidden="true"
                          />
                          <span>Sepetim</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {cartCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                              {cartCount > 99 ? "99+" : cartCount}
                            </span>
                          ) : null}
                          <ChevronRightIcon
                            className="size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                            aria-hidden="true"
                          />
                        </div>
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  );
}
