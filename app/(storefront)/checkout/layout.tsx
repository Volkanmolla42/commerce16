import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckoutRiskContextProvider } from "@/components/checkout/risk-context";
import { signCheckoutRiskContext } from "@/lib/payment-risk-context";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function CheckoutRiskContext({ children }: { children: ReactNode }) {
  const secret = process.env.CHECKOUT_RISK_CONTEXT_SECRET;
  const requestHeaders = await headers();
  const forwardedIp = process.env.VERCEL === "1"
    ? requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : undefined;
  const value = secret && secret.length >= 32 && forwardedIp && forwardedIp.length <= 45
    ? await signCheckoutRiskContext(forwardedIp, secret)
    : null;

  return <CheckoutRiskContextProvider value={value}>{children}</CheckoutRiskContextProvider>;
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CheckoutRiskContext>{children}</CheckoutRiskContext>
    </Suspense>
  );
}
