"use client";

import { useEffect, useState } from "react";
import { TruckIcon } from "@heroicons/react/24/outline";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function istanbulParts(date: Date) {
  const parts = timeFormatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return { weekday: WEEKDAYS[weekday] ?? 0, hour };
}

export function DeliveryEstimate({
  cutoffHour,
  estimate,
  available,
}: {
  cutoffHour: number;
  estimate: string;
  available: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      const current = new Date();
      setNow(current);
      const nextHour = Math.ceil((current.getTime() + 1) / 3_600_000) * 3_600_000;
      timer = window.setTimeout(tick, nextHour - current.getTime());
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  const cutoffLabel = `${String(cutoffHour).padStart(2, "0")}:00`;
  const parts = now ? istanbulParts(now) : null;
  const cutoffText =
    available && cutoffHour > 0
      ? parts
        ? parts.weekday >= 1 && parts.weekday <= 5 && parts.hour < cutoffHour
          ? `Bugün ${cutoffLabel}'a kadar sipariş verirseniz aynı gün kargoda.`
          : "Siparişiniz sonraki iş günü kargoda."
        : `Hafta içi ${cutoffLabel}'a kadar verilen siparişler aynı gün kargoda.`
      : null;
  const estimateText = estimate.trim() ? `Tahmini teslimat: ${estimate.trim()}` : null;

  if (!cutoffText && !estimateText) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2">
      <TruckIcon className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="space-y-0.5 text-[11px] leading-4">
        {cutoffText ? <p className="font-medium text-foreground">{cutoffText}</p> : null}
        {estimateText ? <p className="text-muted-foreground">{estimateText}</p> : null}
      </div>
    </div>
  );
}
