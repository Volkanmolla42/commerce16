"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Search, { SearchSkeleton } from "./search";

const HIDE_ON_SCROLL_AFTER = 64;

const headerSearchClassName =
  "order-last w-full min-w-0 md:order-none md:w-auto md:max-w-md md:flex-1";

export function HeaderSearchFallback() {
  return (
    <div className={`${headerSearchClassName} hidden md:block`}>
      <SearchSkeleton />
    </div>
  );
}

export function HeaderSearch() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const next = window.scrollY > HIDE_ON_SCROLL_AFTER;
      setScrolled((current) => (current === next ? current : next));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const isSearchRoute = pathname === "/" || pathname.startsWith("/search");

  return (
    <div
      className={`${headerSearchClassName} ${
        isSearchRoute && !scrolled ? "" : "hidden md:block"
      }`}
    >
      <Suspense fallback={<SearchSkeleton />}>
        <Search />
      </Suspense>
    </div>
  );
}
