"use client";

import { ArrowDownTrayIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { buttonVariants } from "@/components/ui/button";
import { DetailsDropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

const exportFormats = [
  { label: "Excel", format: "xlsx" },
  { label: "CSV", format: "csv" },
] as const;

export function ExportMenu({ type }: { type: string }) {
  return (
    <DetailsDropdown>
      <summary
        aria-label="Dışa aktar"
        className={cn(buttonVariants({ variant: "outline" }), "min-h-8 cursor-pointer list-none px-3 [&::-webkit-details-marker]:hidden")}
      >
        <ArrowDownTrayIcon aria-hidden="true" className="size-3" />
        <span>İndir</span>
        <ChevronDownIcon aria-hidden="true" className="size-3 text-muted-foreground" />
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-border bg-card p-1 shadow-lg">
        {exportFormats.map((option) => (
          <li key={option.format}>
            <a
              href={`/api/admin/export?type=${type}${option.format === "xlsx" ? "&format=xlsx" : ""}`}
              download
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
              className="block rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </DetailsDropdown>
  );
}
