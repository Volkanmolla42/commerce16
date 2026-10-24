type DateInput = number | string | Date | null | undefined;

function format(input: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string {
  if (input === null || input === undefined || input === "") return fallback;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat("tr-TR", options).format(date);
}

/** Varsayılan: "13 Eki 2026 12:30" */
export function formatDateTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  fallback = "—",
): string {
  return format(input, options, fallback);
}

/** Varsayılan: "13 Eki 2026" */
export function formatDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  fallback = "—",
): string {
  return format(input, options, fallback);
}
