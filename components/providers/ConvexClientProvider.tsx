"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-context";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <CartProvider>{children}</CartProvider>
    </ConvexAuthProvider>
  );
}
