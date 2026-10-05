import { AccountShell } from "./_components/account-shell";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountShell>{children}</AccountShell>;
}
