import { ReactNode } from "react";
import { AdminGate } from "./_components/admin-gate";
import { AdminShell } from "./_components/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
