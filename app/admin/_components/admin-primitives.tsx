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

export function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-border bg-muted text-muted-foreground",
    paid: "border-transparent bg-primary text-primary-foreground",
    shipped: "border-input bg-card text-foreground",
    delivered: "border-input bg-accent text-accent-foreground",
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
