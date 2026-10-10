import { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminGate } from "./_components/admin-gate";
import { AdminThemeShell } from "./admin-theme-shell";
import { hasAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const isAuthenticated = await hasAdminSession();

  if (!isAuthenticated) {
    return <AdminGate />;
  }

  return <AdminThemeShell>{children}</AdminThemeShell>;
}
