import { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminShell } from "./_components/admin-shell";
import { AdminGate } from "./_components/admin-gate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGate><AdminShell>{children}</AdminShell></AdminGate>;
}
