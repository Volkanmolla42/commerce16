"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { orderStatusLabels } from "@/lib/orders";

export function AdminPageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-neutral-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-[28px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-600">{description}</p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function AdminNotice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  const style = {
    info: "border-neutral-200 bg-white text-neutral-700",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-neutral-200 bg-neutral-50 text-neutral-800",
  }[kind];
  return <p role={kind === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-md border px-4 py-3 text-sm ${style}`}>{children}</p>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-neutral-200 bg-neutral-50 text-neutral-600",
    paid: "border-neutral-950 bg-neutral-950 text-white",
    shipped: "border-neutral-300 bg-white text-neutral-700",
    delivered: "border-neutral-300 bg-neutral-100 text-neutral-950",
    cancelled: "border-neutral-200 bg-white text-neutral-400",
  };
  return (
    <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-xs font-medium shadow-none ${styles[status] || "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
      {orderStatusLabels[status as keyof typeof orderStatusLabels] || status}
    </Badge>
  );
}

export function AdminLoading({ label }: { label: string }) {
  return (
    <div role="status" className="rounded-lg border border-neutral-200 bg-white px-5 py-8">
      <div className="mb-3 h-3 w-28 animate-pulse rounded-sm bg-neutral-100" />
      <p className="text-sm text-neutral-500">{label} yükleniyor…</p>
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
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-600">{description}</p>
    </div>
  );
}
