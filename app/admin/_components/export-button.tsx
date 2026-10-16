"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";

export function CsvExportButton({ type, label }: { type: string; label: string }) {
  return (
    <Button asChild variant="outline" className="min-h-8 gap-1.5 px-3">
      <a href={`/api/admin/export?type=${type}`} download aria-label={label}>
        <ArrowDownTrayIcon aria-hidden="true" className="size-3" />
        <span>CSV</span>
      </a>
    </Button>
  );
}
