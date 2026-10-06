"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createFavoritesStore } from "./favorites-store";

type FavoritesContextValue = {
  favoriteSlugs: string[];
  isReady: boolean;
  isFavorite: (productSlug: string) => boolean;
  toggleFavorite: (productSlug: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [guestStore] = useState(createFavoritesStore);
  const guestSlugs = useSyncExternalStore(
    guestStore.subscribe,
    guestStore.getSnapshot,
    guestStore.getServerSnapshot,
  );
  const guestStoreReady = useSyncExternalStore(
    guestStore.subscribe,
    guestStore.getIsLoaded,
    guestStore.getServerIsLoaded,
  );
  const cloudSlugs = useQuery(
    api.favorites.getMyFavoriteSlugs,
    !authLoading && isAuthenticated ? {} : "skip",
  );
  const setMyFavorite = useMutation(api.favorites.setMyFavorite);
  const mergeMyFavorites = useMutation(api.favorites.mergeMyFavorites);
  const mergeInProgress = useRef(false);

  const favoriteSlugs = useMemo(
    () => [...new Set(isAuthenticated ? [...(cloudSlugs ?? []), ...guestSlugs] : guestSlugs)],
    [cloudSlugs, guestSlugs, isAuthenticated],
  );

  useEffect(() => {
    if (
      !guestStoreReady || authLoading || !isAuthenticated || cloudSlugs === undefined ||
      guestSlugs.length === 0 || mergeInProgress.current
    ) return;

    const slugsToMerge = [...guestSlugs];
    mergeInProgress.current = true;
    void mergeMyFavorites({ productSlugs: slugsToMerge })
      .then((acceptedSlugs) => {
        if (acceptedSlugs.length) guestStore.removeFavorites(acceptedSlugs);
      })
      .catch(() => {
        // Keep unsynced items locally so a later session can retry the merge.
      })
      .finally(() => {
        mergeInProgress.current = false;
      });
  }, [authLoading, cloudSlugs, guestSlugs, guestStore, guestStoreReady, isAuthenticated, mergeMyFavorites]);

  const toggleFavorite = useCallback(async (productSlug: string) => {
    const nextIsFavorite = !favoriteSlugs.includes(productSlug);
    const cloudContainsSlug = cloudSlugs?.includes(productSlug) ?? false;
    const isGuestOnly = guestSlugs.includes(productSlug) && !cloudContainsSlug;

    if (authLoading || !isAuthenticated || cloudSlugs === undefined || isGuestOnly) {
      const nextSlugs = nextIsFavorite
        ? [...guestSlugs, productSlug]
        : guestSlugs.filter((slug) => slug !== productSlug);
      guestStore.setFavorites(nextSlugs);
      return;
    }

    await setMyFavorite({ productSlug, isFavorite: nextIsFavorite });
    guestStore.removeFavorites([productSlug]);
  }, [authLoading, cloudSlugs, favoriteSlugs, guestSlugs, guestStore, isAuthenticated, setMyFavorite]);

  const value = useMemo<FavoritesContextValue>(() => ({
    favoriteSlugs,
    isReady: guestStoreReady && !authLoading && (!isAuthenticated || cloudSlugs !== undefined),
    isFavorite: (productSlug) => favoriteSlugs.includes(productSlug),
    toggleFavorite,
  }), [authLoading, cloudSlugs, favoriteSlugs, guestStoreReady, isAuthenticated, toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within a FavoritesProvider");
  return context;
}
