"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartIcon } from "@heroicons/react/24/outline";
import {
  ShoppingBag01Icon,
  UserIcon,
  Location01Icon,
} from "hugeicons-react";
import { Sk } from "./skeleton";

const NAV_ITEMS = [
  { label: "Favorilerim", href: "/favorites", icon: HeartIcon },
  { label: "Siparişlerim", href: "/account/orders", icon: ShoppingBag01Icon },
  { label: "Adreslerim", href: "/account/addresses", icon: Location01Icon },
  { label: "Profil ve Güvenlik", href: "/account/profile", icon: UserIcon },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active =
          href === "/account/profile"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountNavSkeleton() {
  return (
    <div className="flex flex-row gap-1 lg:flex-col">
      {NAV_ITEMS.map(({ href }) => (
        <div
          key={href}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
        >
          <Sk className="h-4 w-4" />
          <Sk className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
