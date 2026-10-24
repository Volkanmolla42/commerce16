export type FunnelKey = "sessions" | "product_view" | "add_to_cart" | "checkout_started" | "purchase";

export function isUuid(value: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

export function cleanAttribution(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120).toLocaleLowerCase("tr-TR");
}

const monthKeyFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayLabelFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
});
const monthLabelFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  month: "short",
  year: "numeric",
});

export function monthKey(timestamp: number) {
  const parts = monthKeyFormatter.formatToParts(timestamp);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function dayKey(timestamp: number) {
  const parts = dayKeyFormatter.formatToParts(timestamp);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return monthLabelFormatter.format(new Date(Date.UTC(year, value - 1, 15, 12)));
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

export function centsFromAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

export function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10_000) / 100 : 0;
}

export function stage(
  key: FunnelKey,
  label: string,
  sessions: number,
  previous: number,
) {
  const conversionFromPrevious = key === "sessions" ? 100 : percentage(sessions, previous);
  return {
    key,
    label,
    sessions,
    conversionFromPrevious,
    dropOffFromPrevious: key === "sessions" || previous === 0
      ? 0
      : Math.max(0, Math.round((100 - conversionFromPrevious) * 100) / 100),
  };
}
