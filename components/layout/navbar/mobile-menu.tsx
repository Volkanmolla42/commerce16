"use client";

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import {
  Bars3Icon,
  ChevronRightIcon,
  HeartIcon,
  ShoppingBagIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useFavorites } from "@/components/favorites/favorites-context";
import { useCart } from "@/components/cart/cart-context";
import StoreInitial from "@/components/store-initial";
import { getProductImages } from "@/lib/catalog/product-images";
import type { Category } from "@/lib/catalog/types";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MobileMenu({
  categories,
  storeName = "Mağaza",
  logoUrl,
}: {
  categories: Category[];
  storeName?: string;
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(categories[0]?.slug ?? "");
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
            <DialogPanel className="fixed inset-y-0 left-0 flex h-dvh w-[min(30rem,calc(100vw-1rem))] flex-col bg-white shadow-xl dark:bg-black">
              {/* Üst Kısım: logo + mağaza adı + kapatma */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
                <Link
                  href="/"
                  prefetch={true}
                  onClick={closeMobileMenu}
                  className="flex min-w-0 items-center gap-2.5"
                >
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={storeName}
                      width={32}
                      height={32}
                      unoptimized
                      className="size-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  ) : (
                    <StoreInitial storeName={storeName} size="sm" />
                  )}
                  <DialogTitle className="truncate text-xs font-semibold tracking-wider uppercase text-neutral-900 dark:text-white">
                    {storeName}
                  </DialogTitle>
                </Link>
                <button
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  onClick={closeMobileMenu}
                  aria-label="Menüyü kapat"
                >
                  <XMarkIcon className="size-5" aria-hidden="true" />
                </button>
              </div>

              {/* Orta Kısım: solda kategoriler, sağda seçili kategorinin ürünleri */}
              <div className="flex min-h-0 flex-1">
                <nav
                  aria-label="Kategoriler"
                  className="w-32 shrink-0 overflow-y-auto border-r border-neutral-200 dark:border-neutral-800"
                >
                  <ul className="py-2">
                    {categories.map((category) => {
                      const active = category.slug === selectedSlug;
                      const itemClassName = `flex min-h-11 w-full flex-col justify-center gap-0.5 px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        active
                          ? "bg-neutral-100 text-black dark:bg-neutral-900 dark:text-white"
                          : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900"
                      }`;
                      return (
                        <li key={category.slug || "all"}>
                          {active ? (
                            <Link
                              href={category.path}
                              onClick={closeMobileMenu}
                              aria-current="true"
                              className={itemClassName}
                            >
                              <span className="line-clamp-2">{category.title}</span>
                              <span className="flex items-center gap-0.5 text-[10px] leading-tight font-medium text-blue-600 dark:text-blue-400">
                                Tümünü gör
                                <ChevronRightIcon className="size-3" aria-hidden="true" />
                              </span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedSlug(category.slug)}
                              className={itemClassName}
                            >
                              <span className="line-clamp-2">{category.title}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="min-w-0 flex-1 overflow-y-auto p-3">
                  {isOpen ? (
                    <CategoryProducts slug={selectedSlug} onNavigate={closeMobileMenu} />
                  ) : null}
                </div>
              </div>

              {/* Alt Kısım: hesap, favoriler, sepet */}
              <div className="shrink-0 border-t border-neutral-200 p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
                <ul className="flex flex-col gap-0.5">
                  <li>
                    <Link
                      href={isAuthenticated ? "/account/orders" : "/login"}
                      onClick={closeMobileMenu}
                      className="group flex min-h-9 items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <UserIcon
                          className="size-4 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                          aria-hidden="true"
                        />
                        <span className="truncate">{isAuthenticated ? userName : "Giriş Yap"}</span>
                      </span>
                      <ChevronRightIcon
                        className="size-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/account/favorites"
                      onClick={closeMobileMenu}
                      className="group flex min-h-9 items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <HeartIcon
                          className="size-4 shrink-0 text-neutral-500 transition-colors group-hover:text-rose-600 dark:text-neutral-400 dark:group-hover:text-rose-400"
                          aria-hidden="true"
                        />
                        <span>Favorilerim</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {favoritesCount > 0 ? (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                            {favoritesCount > 99 ? "99+" : favoritesCount}
                          </span>
                        ) : null}
                        <ChevronRightIcon
                          className="size-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/cart"
                      onClick={closeMobileMenu}
                      className="group flex min-h-9 items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100 hover:text-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <ShoppingBagIcon
                          className="size-4 shrink-0 text-neutral-500 transition-colors group-hover:text-black dark:text-neutral-400 dark:group-hover:text-white"
                          aria-hidden="true"
                        />
                        <span>Sepetim</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {cartCount > 0 ? (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                            {cartCount > 99 ? "99+" : cartCount}
                          </span>
                        ) : null}
                        <ChevronRightIcon
                          className="size-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-black dark:text-neutral-500 dark:group-hover:text-white"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </li>
                </ul>
              </div>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  );
}

function CategoryProducts({
  slug,
  onNavigate,
}: {
  slug: string;
  onNavigate: () => void;
}) {
  const products = useQuery(api.products.list, {
    categorySlug: slug || undefined,
    limit: 12,
  });

  if (products === undefined) {
    return (
      <ul className="grid grid-cols-2 gap-2.5" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="space-y-1.5">
            <div className="aspect-square animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </li>
        ))}
      </ul>
    );
  }

  if (products.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-neutral-500">
        Bu kategoride ürün bulunmuyor.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {products.map((product) => {
        const imageUrl = getProductImages(product)[0]?.url;
        return (
          <li key={product._id}>
            <Link
              href={`/product/${product.slug}`}
              onClick={onNavigate}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.title}
                    fill
                    sizes="(min-width: 640px) 140px, 120px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <span className="mt-1.5 line-clamp-2 block text-[11px] font-medium leading-tight text-neutral-800 dark:text-neutral-200">
                {product.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
