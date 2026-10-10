"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  HeartIcon,
  MapPinIcon,
  ShoppingBagIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useFavorites } from "@/components/favorites/favorites-context";

const NAV_ITEMS = [
  { label: "Favorilerim", href: "/account/favorites", icon: HeartIcon },
  { label: "Siparişlerim", href: "/account/orders", icon: ShoppingBagIcon },
  { label: "Adreslerim", href: "/account/addresses", icon: MapPinIcon },
  { label: "Profil ve Güvenlik", href: "/account/profile", icon: UserIcon },
] as const;

export function AccountNav() {
  const { favoriteSlugs, isReady } = useFavorites();
  const orders = useQuery(api.orders.getMyOrders);

  return (
    <AccountNavLinks
      pathname={usePathname()}
      favoriteCount={isReady ? favoriteSlugs.length : undefined}
      orderCount={orders?.length}
    />
  );
}

export function AccountNavFallback() {
  return <AccountNavLinks pathname="" />;
}

function AccountNavLinks({
  pathname,
  favoriteCount,
  orderCount,
}: {
  pathname: string;
  favoriteCount?: number;
  orderCount?: number;
}) {
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active =
          href === "/account/profile"
            ? pathname === href
            : pathname.startsWith(href);
        const count = href === "/account/favorites"
          ? favoriteCount
          : href === "/account/orders"
            ? orderCount
            : undefined;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition lg:w-full ${
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
            {count !== undefined ? (
              <span className="ml-auto min-w-6 rounded-full bg-muted px-2 py-0.5 text-center text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
