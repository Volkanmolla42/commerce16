"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SignedCheckoutRiskContext } from "@/lib/payment-risk-context";

const CheckoutRiskContext = createContext<SignedCheckoutRiskContext | null>(null);

export function CheckoutRiskContextProvider({ value, children }: {
  value: SignedCheckoutRiskContext | null;
  children: ReactNode;
}) {
  return <CheckoutRiskContext.Provider value={value}>{children}</CheckoutRiskContext.Provider>;
}

export function useCheckoutRiskContext() {
  return useContext(CheckoutRiskContext);
}
