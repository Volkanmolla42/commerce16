const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_NEW_BADGE_DAYS = 14;
export const MAX_NEW_BADGE_DAYS = 365;

export function resolveNewBadgeDays(value?: number | null) {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : DEFAULT_NEW_BADGE_DAYS;
}

export function isNewProduct({
  createdAt,
  publishedAt,
  now,
  days,
}: {
  createdAt?: number;
  publishedAt?: number;
  now?: number;
  days?: number | null;
}) {
  const threshold = resolveNewBadgeDays(days);
  if (threshold <= 0 || now === undefined) return false;
  const since = publishedAt ?? createdAt;
  if (since === undefined) return false;
  return now - since <= threshold * DAY_MS;
}
