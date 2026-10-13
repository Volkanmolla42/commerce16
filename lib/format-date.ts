type DateInput = number | string | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Tarih ve saati Türkçe yerel ayarlara uygun şekilde formatlar.
 * Varsayılan: "13 Eki 2026 12:30" (orta tarih, kısa saat)
 */
export function formatDateTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  fallback = "—"
): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("tr-TR", options).format(d);
}

/**
 * Sadece tarihi Türkçe yerel ayarlara uygun şekilde formatlar.
 * Varsayılan: "13 Ekim 2026" (uzun veya orta)
 */
export function formatDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  fallback = "—"
): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("tr-TR", options).format(d);
}
