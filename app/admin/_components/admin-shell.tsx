"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, Suspense, useState } from "react";
import {
  MoonIcon,
  SunIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CubeIcon,
  ArchiveBoxIcon,
  FolderIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { ArrowUpRight01Icon } from "hugeicons-react";
import { Button } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ADMIN_BASE_PATH, adminPath } from "@/lib/admin/routes";
import StoreInitial from "@/components/store-initial";

const navigation = [
  { label: "Genel Bakış", href: adminPath(), icon: Squares2X2Icon },
  { label: "Ürünler", href: adminPath("products"), icon: CubeIcon },
  { label: "Stok", href: adminPath("inventory"), icon: ArchiveBoxIcon },
  { label: "Kategoriler", href: adminPath("categories"), icon: FolderIcon },
  { label: "Kuponlar", href: adminPath("coupons"), icon: TagIcon },
  { label: "Siparişler", href: adminPath("orders"), icon: ShoppingBagIcon },
  { label: "Sepetler", href: adminPath("carts"), icon: ShoppingCartIcon },
  { label: "Analitik", href: adminPath("analytics"), icon: ChartBarIcon },
  { label: "Mağaza ayarları", href: adminPath("settings"), icon: Cog6ToothIcon },
];

type AdminTheme = "light" | "dark";

function isActive(pathname: string, href: string) {
  return href === adminPath() ? pathname === href : pathname.startsWith(href);
}

function AdminNavLinks({
  compact = false,
  pathname,
}: {
  compact?: boolean;
  pathname: string;
}) {
  return (
    <nav aria-label="Yönetim alanları" className={compact ? "flex gap-1 overflow-x-auto px-3 pb-3" : "space-y-0.5"}>
      {navigation.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={compact
              ? `flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`
              : `flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminNavigation({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return <AdminNavLinks compact={compact} pathname={pathname} />;
}

function AdminNavigationBoundary({ compact = false }: { compact?: boolean }) {
  return (
    <Suspense fallback={<AdminNavLinks compact={compact} pathname="" />}>
      <AdminNavigation compact={compact} />
    </Suspense>
  );
}

export function AdminShell({ children, initialTheme }: { children: ReactNode; initialTheme: AdminTheme }) {
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const storeName = storeSettings?.storeName || "Mağaza";
  const logoUrl = storeSettings?.logoUrl || "";

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `admin-theme=${nextTheme}; Path=${ADMIN_BASE_PATH}; Max-Age=31536000; SameSite=Lax${secure}`;
  };

  const themeToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Koyu temaya geç" : "Açık temaya geç"}
    >
      {theme === "light" ? <MoonIcon aria-hidden="true" className="mr-2 size-4" /> : <SunIcon aria-hidden="true" className="mr-2 size-4" />}
      {theme === "light" ? "Koyu tema" : "Açık tema"}
    </Button>
  );

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/admin-auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Çıkış yapılamadı. Tekrar dene.");
      window.location.replace(adminPath());
    } catch {
      setLogoutError("Çıkış yapılamadı. Tekrar dene.");
      setLoggingOut(false);
    }
  };

  return (
    <div data-admin-theme={theme} className="admin-theme min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Link href={adminPath()} aria-label="Yönetim paneli ana sayfası" className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {logoUrl ? <Image src={logoUrl} alt={storeName} width={32} height={32} unoptimized className="size-8 object-contain" /> : <StoreInitial storeName={storeName} size="xs" />}
          </Link>
          <span className="min-w-0">
            <Link href="/" target="_blank" className="flex max-w-52 items-center gap-1 text-sm font-semibold text-foreground hover:underline">
              <span className="truncate">{storeName}</span>
              <ArrowUpRight01Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
            <span className="mt-0.5 block text-xs text-muted-foreground">Yönetim paneli</span>
          </span>
        </div>
        <AdminNavigationBoundary />
        <div className="mt-auto space-y-1 border-t border-border pt-4">
          {themeToggle}
          <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="w-full justify-start">
            {loggingOut ? "Çıkılıyor…" : "Çıkış"}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-card lg:hidden">
          <div className="flex min-h-14 items-center gap-3 px-4">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              {logoUrl ? <Image src={logoUrl} alt={storeName} width={32} height={32} unoptimized className="size-8 object-contain" /> : <StoreInitial storeName={storeName} size="xs" />}
            </span>
            <Link href="/" target="_blank" className="flex min-w-0 items-center gap-1 text-sm font-medium hover:underline">
              <span className="truncate">{storeName}</span>
              <ArrowUpRight01Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <div className="border-t border-border">
            <AdminNavigationBoundary compact />
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <div className="flex-1">{themeToggle}</div>
            <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="flex-1">
              {loggingOut ? "Çıkılıyor…" : "Çıkış"}
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-8">
          {logoutError && <p role="alert" className="mb-4 text-sm text-destructive">{logoutError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShellFallback() {
  return (
    <div className="min-h-[100dvh] bg-neutral-100 text-foreground dark:bg-neutral-900">
      <aside aria-hidden="true" className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="size-8 rounded-md bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-2.5 w-20 rounded bg-muted" />
          </div>
        </div>
        <AdminNavLinks pathname="" />
        <div className="mt-auto border-t border-border pt-4">
          <div className="h-9 rounded-md bg-muted" />
        </div>
      </aside>
      <div className="lg:pl-72">
        <div className="border-b border-border bg-card p-4 lg:hidden">
          <div className="h-8 w-32 rounded bg-muted" />
        </div>
        <main aria-label="Yönetim paneli yükleniyor" className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-7 sm:py-8">
          <div className="h-8 w-44 rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-xl border border-border bg-card" />)}
          </div>
          <div className="h-56 rounded-xl border border-border bg-card" />
        </main>
      </div>
    </div>
  );
}
