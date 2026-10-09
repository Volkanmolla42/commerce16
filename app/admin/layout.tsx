import { ReactNode } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShellFallback } from "./_components/admin-shell";
import { AdminGate } from "./_components/admin-gate";
import { AdminThemeShell } from "./admin-theme-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <Suspense fallback={<AdminShellFallback />}>
        <AdminThemeShell>{children}</AdminThemeShell>
      </Suspense>
    </AdminGate>
  );
}
