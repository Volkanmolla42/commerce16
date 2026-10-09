import { ReactNode } from "react";
import { cookies } from "next/headers";
import { AdminShell } from "./_components/admin-shell";

export async function AdminThemeShell({ children }: { children: ReactNode }) {
  const savedTheme = (await cookies()).get("admin-theme")?.value;
  const initialTheme = savedTheme === "dark" ? "dark" : "light";

  return <AdminShell initialTheme={initialTheme}>{children}</AdminShell>;
}
