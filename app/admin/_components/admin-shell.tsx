"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Fragment, ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  Bars3Icon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CubeIcon,
  ArchiveBoxIcon,
  FolderIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ADMIN_BASE_PATH, adminPath } from "@/lib/admin/routes";
import { AdminHeaderContext } from "./admin-header-action";
import StoreInitial from "@/components/store-initial";

const navigation = [
  { label: "Genel Bakış", href: adminPath(), icon: Squares2X2Icon },
  { label: "Ürünler", href: adminPath("products"), icon: CubeIcon },
  { label: "Stok", href: adminPath("inventory"), icon: ArchiveBoxIcon },
  { label: "Kategoriler", href: adminPath("categories"), icon: FolderIcon },
  { label: "Kuponlar", href: adminPath("coupons"), icon: TagIcon },
  { label: "Siparişler", href: adminPath("orders"), icon: ShoppingBagIcon },
  { label: "Müşteriler", href: adminPath("customers"), icon: UsersIcon },
  { label: "Sepetler", href: adminPath("carts"), icon: ShoppingCartIcon },
  { label: "Analitik", href: adminPath("analytics"), icon: ChartBarIcon },
  { label: "Mağaza ayarları", href: adminPath("settings"), icon: Cog6ToothIcon },
];

type AdminTheme = "light" | "dark";

function isActive(pathname: string, href: string) {
  return href === adminPath() ? pathname === href : pathname.startsWith(href);
}
function AdminNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Yönetim alanları" className="space-y-0.5">
      {navigation.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, initialTheme }: { children: ReactNode; initialTheme: AdminTheme }) {
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const pathname = usePathname();
  const pageTitle = navigation.find((item) => isActive(pathname, item.href))?.label ?? "Yönetim paneli";
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const storeName = storeSettings?.storeName || "Mağaza";
  const logoUrl = storeSettings?.logoUrl || "";

  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const logoBadge = (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
      {logoUrl ? <Image src={logoUrl} alt={storeName} width={32} height={32} unoptimized className="size-8 object-contain" /> : <StoreInitial storeName={storeName} size="xs" />}
    </span>
  );

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

  const logoutButton = (
    <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="w-full justify-start">
      {loggingOut ? "Çıkılıyor…" : "Çıkış"}
    </Button>
  );

  return (
    <AdminHeaderContext.Provider value={{ route: pathname, slot: actionSlot }}>
    <div data-admin-theme={theme} className="admin-theme min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Link href={adminPath()} aria-label="Yönetim paneli ana sayfası" className="shrink-0">
            {logoBadge}
          </Link>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{storeName}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Yönetim paneli</span>
          </span>
        </div>
        <AdminNavLinks pathname={pathname} />
        <div className="mt-auto space-y-1 border-t border-border pt-4">
          {themeToggle}
          {logoutButton}
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-card px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Yönetim menüsünü aç"
            className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
          >
            <Bars3Icon aria-hidden="true" className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-1 text-base font-semibold text-foreground sm:text-lg">{pageTitle}</h1>
          <div ref={setActionSlot} className="flex shrink-0 items-center gap-2" />
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
          {logoutError && <p role="alert" className="mb-4 text-sm text-destructive">{logoutError}</p>}
          {children}
        </main>
      </div>

      <Transition show={menuOpen}>
        <Dialog onClose={() => setMenuOpen(false)} className="relative z-50 lg:hidden">
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
            <DialogPanel className="fixed inset-y-0 left-0 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col bg-card shadow-xl">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4">
                <span className="flex min-w-0 items-center gap-2">
                  {logoBadge}
                  <DialogTitle className="truncate text-sm font-semibold text-foreground">{storeName}</DialogTitle>
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Menüyü kapat"
                  className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <XMarkIcon aria-hidden="true" className="size-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <AdminNavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                <div className="mt-6 space-y-1 border-t border-border pt-4">
                  {themeToggle}
                  {logoutButton}
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </div>
    </AdminHeaderContext.Provider>
  );
}
