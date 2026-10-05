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
import { Button } from "@/components/ui/button";
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
  const currentPage = navigation.find((item) => isActive(pathname, item.href));

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
              ? `flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium ${active ? "bg-neutral-100 text-neutral-950" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`
              : `flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors ${active ? "bg-neutral-100 text-neutral-950" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-neutral-500" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-neutral-50 text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-neutral-200 bg-white px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-black text-sm font-semibold text-white">C</span>
          <span>
            <span className="block max-w-40 truncate text-sm font-semibold text-neutral-950">{storeName}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">Yönetim paneli</span>
          </span>
        </Link>
        {nav()}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-black text-sm font-semibold text-white lg:hidden">C</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{currentPage?.label || "Yönetim"}</p>
                <p className="hidden text-xs text-neutral-500 sm:block">{storeName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden rounded-md border-neutral-200 bg-white shadow-none hover:bg-neutral-50 sm:inline-flex">
                <Link href="/" target="_blank"><span>Mağazayı aç</span></Link>
              </Button>
              <Button disabled={loggingOut} onClick={() => void logout()} variant="ghost" size="sm" className="rounded-md text-neutral-600 shadow-none hover:bg-neutral-100 hover:text-neutral-950">
                {loggingOut ? "Çıkılıyor…" : "Çıkış"}
              </Button>
            </div>
          </div>
          <div className="border-t border-neutral-100 lg:hidden">{nav(true)}</div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-8">
          {logoutError && <p role="alert" className="mb-4 text-sm text-rose-700">{logoutError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
