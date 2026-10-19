"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import type { AnalyticsDashboard } from "@/lib/analytics/types";

type Metric = "revenue" | "orders" | "sessions";

type DisplayPoint = {
  key: string;
  label: string;
  revenueCents: number;
  orderCount: number;
  sessions: number;
};

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: "revenue", label: "Ciro" },
  { key: "orders", label: "Sipariş" },
  { key: "sessions", label: "Oturum" },
];

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const compactFormatter = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function metricValue(point: DisplayPoint, metric: Metric) {
  if (metric === "revenue") return point.revenueCents;
  if (metric === "orders") return point.orderCount;
  return point.sessions;
}

function formatMetric(value: number, metric: Metric) {
  return metric === "revenue" ? formatMoney(value / 100) : formatNumber(value);
}

function formatCompactMetric(value: number, metric: Metric) {
  return metric === "revenue" ? `${compactFormatter.format(value / 100)} TL` : compactFormatter.format(value);
}

function displayPoints(data: AnalyticsDashboard) {
  const daily: DisplayPoint[] = data.trend.map((point) => ({
    key: point.key,
    label: point.label,
    revenueCents: point.revenueCents,
    orderCount: point.orderCount,
    sessions: point.sessions,
  }));
  if (data.days !== 90) return daily;

  const weekly: DisplayPoint[] = [];
  for (let index = 0; index < daily.length; index += 7) {
    const chunk = daily.slice(index, index + 7);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    weekly.push({
      key: first.key,
      label: `${first.label} – ${last.label}`,
      revenueCents: chunk.reduce((sum, point) => sum + point.revenueCents, 0),
      orderCount: chunk.reduce((sum, point) => sum + point.orderCount, 0),
      sessions: chunk.reduce((sum, point) => sum + point.sessions, 0),
    });
  }
  return weekly;
}

function labelIndices(length: number, maxCount: number) {
  if (length <= 1) return [0];
  const count = Math.min(maxCount, length);
  return [...new Set(Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * (length - 1))))];
}

export function AnalyticsTrendChart({ data, className = "" }: { data: AnalyticsDashboard; className?: string }) {
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const points = displayPoints(data);
  const metric = selectedMetric ?? (data.summary.revenueCents > 0 ? "revenue" : data.summary.orderCount > 0 ? "orders" : "sessions");
  const values = points.map((point) => metricValue(point, metric));
  const max = Math.max(...values, 0);
  const lastActiveIndex = values.reduce((last, value, index) => value > 0 ? index : last, -1);
  const activeIndex = selectedPoint !== null && selectedPoint < points.length
    ? selectedPoint
    : lastActiveIndex >= 0 ? lastActiveIndex : points.length - 1;
  const activePoint = points[activeIndex];
  const hasData = values.some((value) => value > 0);
  const indices = labelIndices(points.length, data.days === 90 ? 3 : 5);
  const metricLabel = METRICS.find((item) => item.key === metric)?.label ?? "";

  return (
    <Card className={`overflow-hidden rounded-xl ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Satış Trendi</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.days === 90 ? "Haftalık toplamlar" : "Günlük dağılım"} · {formatDateTime(data.generatedAt, { dateStyle: "medium", timeStyle: "short" })} itibarıyla
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Trend metriği">
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedMetric(item.key)}
              aria-pressed={metric === item.key}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                metric === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {hasData ? (
          <>
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{data.days === 90 ? "Haftalık toplam" : "Günlük toplam"}</span>
              <span>En yüksek: {formatCompactMetric(max, metric)}</span>
            </div>

            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-border/60" />)}
              </div>
              <div className="relative flex h-44 items-end gap-px">
                {points.map((point, index) => {
                  const value = metricValue(point, metric);
                  const height = max > 0 ? (value / max) * 100 : 0;
                  return (
                    <button
                      key={point.key}
                      type="button"
                      onClick={() => setSelectedPoint(index)}
                      aria-label={`${point.label}: ${formatMetric(value, metric)}`}
                      aria-pressed={index === activeIndex}
                      className="group relative flex h-full flex-1 items-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={`w-full rounded-t-[3px] transition-colors ${
                          index === activeIndex ? "bg-foreground" : "bg-foreground/35 group-hover:bg-foreground/60"
                        }`}
                        style={{ height: value > 0 ? `${Math.max(2, height)}%` : "0%" }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="relative mt-2 h-4">
                {indices.map((index) => (
                  <span
                    key={points[index].key}
                    className="absolute whitespace-nowrap text-[10px] text-muted-foreground"
                    style={{
                      left: `${points.length > 1 ? (index / (points.length - 1)) * 100 : 50}%`,
                      transform: index === 0 ? "translateX(0)" : index === points.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                    }}
                  >
                    {points[index].label}
                  </span>
                ))}
              </div>
            </div>

            {activePoint && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                <span className="font-medium text-foreground">{data.days === 90 ? "Haftalık" : "Günlük"} · {activePoint.label}</span>
                <span className="text-muted-foreground">Ciro <span className="font-semibold text-foreground">{formatMoney(activePoint.revenueCents / 100)}</span></span>
                <span className="text-muted-foreground">Sipariş <span className="font-semibold text-foreground">{formatNumber(activePoint.orderCount)}</span></span>
                <span className="text-muted-foreground">Oturum <span className="font-semibold text-foreground">{formatNumber(activePoint.sessions)}</span></span>
              </div>
            )}
          </>
        ) : (
          <div className="grid h-52 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            Bu dönemde {metricLabel.toLocaleLowerCase("tr-TR")} verisi yok.
          </div>
        )}
      </div>
    </Card>
  );
}
