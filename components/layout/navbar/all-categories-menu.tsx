"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Menu } from "@/lib/catalog/types";

export function AllCategoriesMenu({ categories }: { categories: Menu[] }) {
  const [open, setOpen] = useState(false);
  const pointerInside = useRef(false);
  const panelId = "header-all-categories";

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        pointerInside.current = true;
        setOpen(true);
      }}
      onMouseLeave={(event) => {
        pointerInside.current = false;
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        const focusRemainsInside = nextTarget instanceof Node && event.currentTarget.contains(nextTarget);
        if (!focusRemainsInside && !pointerInside.current) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Link
        href="/search"
        prefetch
        aria-expanded={open}
        aria-controls={panelId}
        className="text-sm font-medium text-neutral-600 transition hover:text-black dark:text-neutral-400 dark:hover:text-white"
      >
        Tümü
      </Link>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-50 w-[min(40rem,calc(100vw-2rem))] pt-3"
      >
        <nav aria-label="Tüm kategoriler" className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Kategoriler</h2>
            <Link href="/search" prefetch={false} className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline dark:hover:text-white">
              Tüm ürünler
            </Link>
          </div>
          {categories.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((category) => (
                <li key={category.path}>
                  <Link
                    href={category.path}
                    prefetch={false}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white dark:focus-visible:outline-white"
                  >
                    {category.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">Henüz kategori yok.</p>
          )}
        </nav>
      </div>
    </div>
  );
}
