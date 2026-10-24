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
  BoltIcon,
  UsersIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
  CreditCardIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { ADMIN_BASE_PATH, adminPath } from "@/lib/admin/routes";
import { AdminHeaderContext } from "./admin-header-action";
import { storeConfig } from "@/lib/store-config";

type NavLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

type NavEntry =
  | {
    type: "link";
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  }
  | {
    type: "group";
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
    items: NavLink[];
  };

const navigation: NavEntry[] = [
  {
    type: "link",
    label: "Genel Bakış",
    href: adminPath(),
    icon: Squares2X2Icon,
  },
  {
    type: "group",
    id: "catalog",
    title: "Katalog",
    icon: CubeIcon,
    items: [
      { label: "Ürünler", href: adminPath("products"), icon: CubeIcon },
      { label: "Stok", href: adminPath("inventory"), icon: ArchiveBoxIcon },
      { label: "Kategoriler", href: adminPath("categories"), icon: FolderIcon },
      { label: "Sorular", href: adminPath("questions"), icon: QuestionMarkCircleIcon },
    ],
  },
  {
    type: "group",
    id: "sales",
    title: "Satışlar",
    icon: ShoppingBagIcon,
    items: [
      { label: "Siparişler", href: adminPath("orders"), icon: ShoppingBagIcon },
      { label: "Müşteriler", href: adminPath("customers"), icon: UsersIcon },
      { label: "Sepetler", href: adminPath("carts"), icon: ShoppingCartIcon },
    ],
  },
  {
    type: "group",
    id: "marketing",
    title: "Pazarlama",
    icon: TagIcon,
    items: [
      { label: "Kuponlar", href: adminPath("coupons"), icon: TagIcon },
      { label: "Kampanyalar", href: adminPath("promotions"), icon: BoltIcon },
      { label: "E-Postalar", href: adminPath("emails"), icon: EnvelopeIcon },
    ],
  },
  {
    type: "link",
    label: "Ödeme Yöntemleri",
    href: adminPath("payments"),
    icon: CreditCardIcon,
  },
  {
    type: "link",
    label: "Analitik",
    href: adminPath("analytics"),
    icon: ChartBarIcon,
  },
];

const settingsLink: NavLink = {
  label: "Mağaza Ayarları",
  href: adminPath("settings"),
  icon: Cog6ToothIcon,
};

const allNavItems: NavLink[] = [
  ...navigation.flatMap((entry) => (entry.type === "link" ? [entry] : entry.items)),
  settingsLink,
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
  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string, currentlyOpen: boolean) => {
    setUserToggledGroups((prev) => ({
      ...prev,
      [groupId]: !currentlyOpen,
    }));
  };

  return (
    <nav aria-label="Yönetim alanları" className="space-y-1.5">
      {navigation.map((entry) => {
        if (entry.type === "link") {
          const active = isActive(pathname, entry.href);
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${active
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{entry.label}</span>
            </Link>
          );
        }

        const hasActiveChild = entry.items.some((item) => isActive(pathname, item.href));
        const isOpen = userToggledGroups[entry.id] ?? hasActiveChild;
        const GroupIcon = entry.icon;

        return (
          <div key={entry.id} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup(entry.id, isOpen)}
              aria-expanded={isOpen}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${!isOpen && hasActiveChild
                ? "text-primary bg-accent/40"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
            >
              <span className="flex items-center gap-2">
                <GroupIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/90" />
                <span>{entry.title}</span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className={`size-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"
                  }`}
              />
            </button>

            {isOpen && (
              <div className="ml-3.5 space-y-0.5 border-l border-border/70 pl-3 py-0.5">
                {entry.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-8.5 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${active
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                    >
                      <ItemIcon aria-hidden="true" className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function AdminSettingsLink({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, settingsLink.href);
  const Icon = settingsLink.icon;

  return (
    <Link
      href={settingsLink.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${active
        ? "bg-accent text-accent-foreground font-semibold"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{settingsLink.label}</span>
    </Link>
  );
}

export function AdminShell({ children, initialTheme }: { children: ReactNode; initialTheme: AdminTheme }) {
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const pathname = usePathname();
  const pageTitle = pathname === adminPath("products/import")
    ? "İçe Aktar"
    : allNavItems.find((item) => isActive(pathname, item.href))?.label ?? "Yönetim paneli";

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
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-white">
      <Image src={storeConfig.logo} alt={storeConfig.name} width={32} height={32} className="size-8 object-contain" />
    </span>
  );

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `admin-theme=${nextTheme}; Path=${ADMIN_BASE_PATH}; Max-Age=31536000; SameSite=Lax${secure}`;
  };

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/admin-auth", { method: "DELETE" });
      if (response.ok) {
        window.location.replace(adminPath());
      } else {
        setLogoutError("Çıkış yapılamadı. Tekrar dene.");
        setLoggingOut(false);
      }
    } catch {
      setLogoutError("Çıkış yapılamadı. Tekrar dene.");
      setLoggingOut(false);
    }
  };

  const bottomBar = (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shadow-2xs"
        aria-label={theme === "light" ? "Koyu temaya geç" : "Açık temaya geç"}
      >
        {theme === "light" ? (
          <MoonIcon aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <SunIcon aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span>{theme === "light" ? "Koyu" : "Açık"}</span>
      </button>

      <button
        type="button"
        disabled={loggingOut}
        onClick={() => void logout()}
        className="flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive cursor-pointer disabled:pointer-events-none disabled:opacity-50 shadow-2xs"
      >
        <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{loggingOut ? "Çıkılıyor…" : "Çıkış"}</span>
      </button>
    </div>
  );

  return (
    <AdminHeaderContext.Provider value={{ route: pathname, slot: actionSlot }}>
      <div data-admin-theme={theme} className={`admin-theme min-h-[100dvh] bg-background text-foreground ${theme === "dark" ? "dark" : ""}`}>
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
          <div className="mb-4 flex items-center gap-2.5 px-1.5">
            <Link href={adminPath()} aria-label="Yönetim paneli ana sayfası" className="shrink-0">
              {logoBadge}
            </Link>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{storeConfig.name}</span>
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>Mağazaya git</span>
                <ArrowTopRightOnSquareIcon className="size-3" aria-hidden="true" />
              </Link>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            <AdminNavLinks pathname={pathname} />
          </div>
          <div className="mt-auto space-y-2.5 border-t border-border pt-2.5">
            <AdminSettingsLink pathname={pathname} />
            {bottomBar}
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

          <main className="mx-auto w-full container px-4 py-6 sm:py-8">
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
                    <span className="min-w-0">
                      <DialogTitle className="truncate text-sm font-semibold text-foreground">{storeConfig.name}</DialogTitle>
                      <Link
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>Mağazaya git</span>
                        <ArrowTopRightOnSquareIcon className="size-3" aria-hidden="true" />
                      </Link>
                    </span>
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
                  <div className="mt-6 space-y-2.5 border-t border-border pt-2.5">
                    <AdminSettingsLink pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                    {bottomBar}
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
