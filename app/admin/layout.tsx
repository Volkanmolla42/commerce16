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
      <AuthenticatedAdminLayout>{children}</AuthenticatedAdminLayout>
    </Suspense>
  );
}

async function AuthenticatedAdminLayout({ children }: { children: ReactNode }) {
  const isAuthenticated = await hasAdminSession();

  if (!isAuthenticated) {
    return <AdminGate />;
  }

  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("admin-theme")?.value;
  const initialTheme = savedTheme === "dark" ? "dark" : "light";

  return <AdminShell initialTheme={initialTheme}>{children}</AdminShell>;
}
