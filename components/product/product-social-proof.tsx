"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  HeartIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";

type SocialProofMessage = {
  key: string;
  icon: ReactNode;
  text: string;
};

export function ProductSocialProof({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const [now, setNow] = useState(0);
  const purchaseActivity = useQuery(
    api.orders.getRecentPurchaseActivity,
    now > 0 ? { productId: productId as Id<"products">, now } : "skip",
  );
  const favoriteCount = useQuery(api.favorites.getProductFavoriteCount, { productSlug });
  const cartCount = useQuery(
    api.activeCarts.getProductCartCount,
    now > 0 ? { productId: productId as Id<"products">, now } : "skip",
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!purchaseActivity?.expiresAt) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(1, purchaseActivity.expiresAt - Date.now() + 50),
    );
    return () => window.clearTimeout(timer);
  }, [purchaseActivity?.expiresAt]);

  const messages: SocialProofMessage[] = [];
  if (purchaseActivity && purchaseActivity.buyerCount > 0) {
    messages.push({
      key: "purchase",
      icon: <ShoppingBagIcon className="size-3.5" aria-hidden="true" />,
      text: `Son 24 saatte ${purchaseActivity.limited ? "en az " : ""}${purchaseActivity.buyerCount} kişi bu ürünü satın aldı`,
    });
  }
  if (favoriteCount && favoriteCount.count > 0) {
    messages.push({
      key: "favorite",
      icon: <HeartIcon className="size-3.5" aria-hidden="true" />,
      text: `${favoriteCount.limited ? "500+" : favoriteCount.count} kişi favoriledi`,
    });
  }
  if (cartCount && cartCount.count > 0) {
    messages.push({
      key: "cart",
      icon: <ShoppingCartIcon className="size-3.5" aria-hidden="true" />,
      text: `${cartCount.limited ? "500+" : cartCount.count} kişinin sepetinde`,
    });
  }

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      3500,
    );
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (messages.length === 0) return null;
  const message = messages[index % messages.length];

  return (
    <div className="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
      <span className="shrink-0 text-emerald-500">{message.icon}</span>
      <span key={message.key} className="min-w-0 animate-fade-in truncate">
        {message.text}
      </span>
    </div>
  );
}
