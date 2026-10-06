"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import {
  Cog6ToothIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { ArrowUpRight01Icon } from "hugeicons-react";
import { Button } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const navigation = [
  { label: "Genel Bakış", href: "/admin", icon: Squares2X2Icon },
  { label: "Ürünler", href: "/admin/products", icon: CubeIcon },
  { label: "Kategoriler", href: "/admin/categories", icon: FolderIcon },
  { label: "Siparişler", href: "/admin/orders", icon: ShoppingBagIcon },
  { label: "Sayfalar", href: "/admin/pages", icon: DocumentTextIcon },
  { label: "Mağaza ayarları", href: "/admin/settings", icon: Cog6ToothIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const storeName = storeSettings?.storeName || "Mağaza";
  const logoUrl = storeSettings?.logoUrl || "";

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/admin-auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Çıkış yapılamadı. Tekrar dene.");
      window.location.replace("/admin");
    } catch {
      setLogoutError("Çıkış yapılamadı. Tekrar dene.");
      setLoggingOut(false);
    }
  };

  const nav = (compact = false) => (
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

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Link href="/admin" aria-label="Yönetim paneli ana sayfası" className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {logoUrl ? <img src={logoUrl} alt={storeName} className="size-8 object-contain" /> : "C"}
          </Link>
          <span className="min-w-0">
            <Link href="/" target="_blank" className="flex max-w-52 items-center gap-1 text-sm font-semibold text-foreground hover:underline">
              <span className="truncate">{storeName}</span>
              <ArrowUpRight01Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
            <span className="mt-0.5 block text-xs text-muted-foreground">Yönetim paneli</span>
          </span>
        </div>
        {nav()}
        <div className="mt-auto border-t border-border pt-4">
          <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="w-full justify-start">
            {loggingOut ? "Çıkılıyor…" : "Çıkış"}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-card lg:hidden">
          <div className="flex min-h-14 items-center gap-3 px-4">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              {logoUrl ? <img src={logoUrl} alt={storeName} className="size-8 object-contain" /> : "C"}
            </span>
            <Link href="/" target="_blank" className="flex min-w-0 items-center gap-1 text-sm font-medium hover:underline">
              <span className="truncate">{storeName}</span>
              <ArrowUpRight01Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <div className="border-t border-border">{nav(true)}</div>
          <div className="border-t border-border px-3 py-3">
            <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="w-full">
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
