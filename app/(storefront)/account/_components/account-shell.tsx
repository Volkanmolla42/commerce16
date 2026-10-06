import { Card } from "@/components/ui";
import { AccountNav } from "./account-nav";
import { SidebarProfile } from "./sidebar-profile";

export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-64">
          <Card className="rounded-3xl border-border bg-card p-5 shadow-xs lg:sticky lg:top-24">
            <SidebarProfile />

            <div className="pt-3">
              <AccountNav />
            </div>
          </Card>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
