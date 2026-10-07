import { AccountShell } from "../account/_components/account-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountShell>{children}</AccountShell>;
}
