export const FAVORITES_STORAGE_KEY = "commerce16:favorites";
const MAX_FAVORITES = 100;
const EMPTY_FAVORITES: string[] = [];

function readFavorites() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return EMPTY_FAVORITES;
    return [...new Set(stored.filter((slug): slug is string =>
      typeof slug === "string" && slug.length > 0 && slug.length <= 200,
    ))].slice(0, MAX_FAVORITES);
  } catch {
    return EMPTY_FAVORITES;
  }
}

export function createFavoritesStore() {
  let favoriteSlugs = EMPTY_FAVORITES;
  let loaded = false;
  let storageListener: ((event: StorageEvent) => void) | undefined;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());
  const load = () => {
    if (loaded) return;
    favoriteSlugs = readFavorites();
    loaded = true;
  };
  const change = (update: (current: string[]) => string[]) => {
    load();
    const next = update(favoriteSlugs);
    if (next === favoriteSlugs) return;
    favoriteSlugs = next;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteSlugs));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
    notify();
  };

  return {
    getSnapshot: () => favoriteSlugs,
    getServerSnapshot: () => EMPTY_FAVORITES,
    getIsLoaded: () => loaded,
    getServerIsLoaded: () => false,
    subscribe(listener: () => void) {
      listeners.add(listener);
      load();
      if (!storageListener) {
        storageListener = (event) => {
          if (event.key !== FAVORITES_STORAGE_KEY && event.key !== null) return;
          favoriteSlugs = readFavorites();
          loaded = true;
          notify();
        };
        window.addEventListener("storage", storageListener);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && storageListener) {
          window.removeEventListener("storage", storageListener);
          storageListener = undefined;
        }
      };
    },
    setFavorites(nextSlugs: string[]) {
      change(() => [...new Set(nextSlugs)].slice(-MAX_FAVORITES));
    },
    removeFavorites(slugs: string[]) {
      const removed = new Set(slugs);
      change((current) => current.filter((slug) => !removed.has(slug)));
    },
  };
}
