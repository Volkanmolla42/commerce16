import { normalizeSearchText } from "../text";
import { hasFunctionalConsent } from "../privacy/consent";

const RECENT_SEARCHES_KEY = "commerce_recent_searches_v1";
const MAX_RECENT_SEARCHES = 5;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined" || !hasFunctionalConsent()) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function recordRecentSearch(query: string) {
  if (typeof window === "undefined" || !hasFunctionalConsent()) return;
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return;
  const normalized = normalizeSearchText(trimmed);
  if (!normalized) return;
  const recent = [
    trimmed,
    ...getRecentSearches().filter((item) => normalizeSearchText(item) !== normalized),
  ].slice(0, MAX_RECENT_SEARCHES);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {
    // Arama geçmişi yalnızca yardımcı veridir; depolama kapalıysa devam edilir.
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Storage may be unavailable; nothing else to clear.
  }
}
