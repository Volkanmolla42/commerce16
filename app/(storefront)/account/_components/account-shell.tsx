"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag01Icon,
  UserIcon,
  Location01Icon,
  Logout01Icon,
  ArrowRight01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NAV_ITEMS = [
  { label: "Siparişlerim", href: "/account/orders", icon: ShoppingBag01Icon },
  { label: "Adreslerim", href: "/account/addresses", icon: Location01Icon },
  { label: "Profil ve Güvenlik", href: "/account/profile", icon: UserIcon },
] as const;

function AccountNav() {
  const pathname = usePathname();

  return (
    <div className="mt-6 flex gap-2 border-b border-border overflow-x-auto pb-px">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active =
          href === "/account/profile"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function AccountNavSkeleton() {
  return (
    <div className="mt-6 flex gap-2 border-b border-border overflow-x-auto pb-px">
      {NAV_ITEMS.map(({ href }) => (
        <div
          key={href}
          className="flex items-center gap-2 border-b-2 border-transparent px-4 py-3"
        >
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.users.getMyProfile);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-20 text-center text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Card className="rounded-3xl border-border bg-card p-8 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-xl font-bold text-foreground">
            Giriş Yapmanız Gerekiyor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hesabınızı ve siparişlerinizi görüntülemek için lütfen giriş yapın.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 w-full rounded-2xl font-semibold shadow-md"
          >
            <Link href="/login">
              Giriş Yap <ArrowRight01Icon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hesabım
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hoş geldiniz,{" "}
            <span className="font-semibold text-foreground">
              {profile?.name || "Kullanıcı"}
            </span>{" "}
            ({profile?.email})
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut()}
          className="self-start rounded-xl gap-2 font-medium border-border"
        >
          <Logout01Icon className="h-4 w-4 text-muted-foreground" />
          <span>Oturumu Kapat</span>
        </Button>
      </div>

      <Suspense fallback={<AccountNavSkeleton />}>
        <AccountNav />
      </Suspense>

      <div className="mt-8">{children}</div>
    </div>
  );
}
