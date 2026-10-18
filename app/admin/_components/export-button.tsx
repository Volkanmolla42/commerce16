"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export function CsvExportButton({
  type,
  label,
  format = "csv",
}: {
  type: string;
  label: string;
  format?: "csv" | "xlsx";
}) {
  return (
    <Button asChild variant="outline" className="min-h-8 gap-1.5 px-3">
      <a
        href={`/api/admin/export?type=${type}${format === "xlsx" ? "&format=xlsx" : ""}`}
        download
        aria-label={label}
      >
        <ArrowDownTrayIcon aria-hidden="true" className="size-3" />
        <span>{format === "xlsx" ? "Excel" : "CSV"}</span>
      </a>
    </Button>
  );
}

