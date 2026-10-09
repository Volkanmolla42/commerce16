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

type AdminLoadingVariant = "page" | "table" | "list" | "form" | "overview" | "analytics" | "settings";

function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-md bg-muted ${className}`} />;
}

function LoadingPageHeader() {
  return (
    <div aria-hidden="true" className="border-b border-border pb-5">
      <SkeletonBlock className="h-7 w-44" />
      <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

function LoadingTableRows() {
  return (
    <div aria-hidden="true" className="divide-y divide-border">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex min-h-[4.5rem] items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SkeletonBlock className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className={`h-3 ${index % 2 ? "w-40" : "w-52"} max-w-full`} />
              <SkeletonBlock className="h-3 w-28 max-w-full" />
            </div>
          </div>
          <div className="hidden w-2/5 items-center justify-between gap-4 sm:flex">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-8 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingMetrics({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className={`grid grid-cols-2 gap-3 ${count === 5 ? "lg:grid-cols-3 2xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-3 h-7 w-28 max-w-full" />
          <SkeletonBlock className="mt-2 h-3 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function LoadingFormSections({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <SkeletonBlock className="h-4 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            {index === 0 && <SkeletonBlock className="h-10 w-full sm:col-span-2" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingListCards() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-40 max-w-full" />
            <SkeletonBlock className="h-3 w-56 max-w-full" />
          </div>
          <SkeletonBlock className="h-8 w-20 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function AdminLoading({
  label,
  variant = "page",
}: {
  label: string;
  variant?: AdminLoadingVariant;
}) {
  if (variant === "table") {
    return <div role="status" aria-label={`${label} yükleniyor`} aria-busy="true"><span className="sr-only">{label} yükleniyor…</span><LoadingTableRows /></div>;
  }
  if (variant === "list") {
    return <div role="status" aria-label={`${label} yükleniyor`} aria-busy="true"><span className="sr-only">{label} yükleniyor…</span><LoadingListCards /></div>;
  }

  return (
    <div role="status" aria-label={`${label} yükleniyor`} aria-busy="true" className="space-y-5">
      <span className="sr-only">{label} yükleniyor…</span>
      <LoadingPageHeader />
      {variant === "overview" ? (
        <>
          <LoadingMetrics />
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div aria-hidden="true" className="border-b border-border px-4 py-4 sm:px-5"><SkeletonBlock className="h-4 w-36" /><SkeletonBlock className="mt-2 h-3 w-24" /></div>
            <LoadingTableRows />
          </div>
        </>
      ) : variant === "analytics" ? (
        <>
          <LoadingMetrics count={5} />
          <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-64 rounded-lg border border-border" />
            <SkeletonBlock className="h-64 rounded-lg border border-border" />
          </div>
        </>
      ) : variant === "form" || variant === "settings" ? (
        <LoadingFormSections />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card"><LoadingTableRows /></div>
      )}
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
