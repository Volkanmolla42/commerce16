const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_NEW_BADGE_DAYS = 14;
export const MAX_NEW_BADGE_DAYS = 365;

export function resolveNewBadgeDays(value?: number | null) {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : DEFAULT_NEW_BADGE_DAYS;
}

export function isNewProduct({
  _creationTime,
  now,
  days,
}: {
  _creationTime?: number;
  now?: number;
  days?: number | null;
}) {
  const threshold = resolveNewBadgeDays(days);
  if (threshold <= 0 || now === undefined || _creationTime === undefined) return false;
  return now - _creationTime <= threshold * DAY_MS;
}
