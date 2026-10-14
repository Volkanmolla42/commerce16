import type { ReactNode } from "react";

/** Mobil alt eylem çubuğundaki birincil butonun ortak sınıfları — sepet ve ödeme aynı görünsün. */
export const mobileSummaryActionClassName =
  "h-12 min-w-0 flex-1 rounded-xl text-sm font-semibold gap-2 shadow-none";

/**
 * Mobilde sayfanın altına sabitlenen tutar + birincil eylem çubuğu.
 * `hideFrom`, sayfanın masaüstü düzenine geçtiği kırılım noktasıdır.
 */
export function MobileSummaryBar({
  label,
  amount,
  hideFrom = "md",
  children,
}: {
  label: string;
  amount: string;
  hideFrom?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background ${
        hideFrom === "lg" ? "lg:hidden" : "md:hidden"
      }`}
    >
      <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center gap-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 shrink-0">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          <span className="block truncate text-lg font-bold tabular-nums text-foreground">
            {amount}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
