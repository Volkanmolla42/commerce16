import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminShell } from "./_components/admin-shell";
import { AdminGate } from "./_components/admin-gate";
import { hasAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div role="status" className="p-6 text-sm text-muted-foreground">Yükleniyor...</div>}
    >
      <AdminChrome>{children}</AdminChrome>
    </Suspense>
  );
}

async function AdminChrome({ children }: { children: ReactNode }) {
  const isAuthenticated = await hasAdminSession();

  // Oturum olmasa da children her zaman render edilir; aksi halde alt segmentler
  // prerender'da düşer ve instant-navigation doğrulaması atlanır. Kapı üstünü kaplar.
  if (!isAuthenticated) {
    return (
      <>
        {children}
        <AdminGate />
      </>
    );
  }

  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("admin-theme")?.value;
  const initialTheme = savedTheme === "dark" ? "dark" : "light";

  return <AdminShell initialTheme={initialTheme}>{children}</AdminShell>;
}
