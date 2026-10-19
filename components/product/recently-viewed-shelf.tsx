"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Shelf } from "./recommendation-shelves";
import { getRecentProductSlugs, RECENT_PRODUCTS_EVENT } from "@/lib/catalog/recommendations";

export function RecentlyViewedShelf({ excludeProductId }: { excludeProductId: string }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setSlugs(getRecentProductSlugs().slice(0, 6));
    update();
    window.addEventListener(RECENT_PRODUCTS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(RECENT_PRODUCTS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const data = useQuery(api.products.getBySlugs, slugs.length > 0 ? { slugs } : "skip");
  const products = (data ?? [])
    .filter((product) => product.id !== excludeProductId)
    .slice(0, 5);

  return <Shelf title="Son gezilenler" products={products} />;
}
