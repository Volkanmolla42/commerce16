"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { orderStatusLabels } from "@/lib/orders";

export function AdminNotice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  const style = {
    info: "border-border bg-card text-muted-foreground",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    success: "border-border bg-muted text-foreground",
  }[kind];
  return <p role={kind === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-md border px-4 py-3 text-sm ${style}`}>{children}</p>;
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </header>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-border bg-muted text-muted-foreground",
    paid: "border-transparent bg-primary text-primary-foreground",
    cancelled: "border-border bg-card text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-xs font-medium ${styles[status] || "border-border bg-muted text-muted-foreground"}`}>
      {orderStatusLabels[status as keyof typeof orderStatusLabels] || status}
    </Badge>
  );
}

export function AdminLoading({ label }: { label: string }) {
  return (
    <div role="status" className="rounded-lg border border-border bg-card px-5 py-8">
      <div className="mb-3 h-3 w-28 animate-pulse rounded-sm bg-muted" />
      <p className="text-sm text-muted-foreground">{label} yükleniyor…</p>
    </div>
  );
}

export function AdminEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-input bg-card px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
