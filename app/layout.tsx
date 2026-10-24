import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { CartProvider } from "@/components/cart/cart-context";
import { Manrope } from "next/font/google";
import { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { baseUrl } from "@/lib/utils";
import { storeConfig } from "@/lib/store-config";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  applicationName: storeConfig.name,
  title: {
    default: `${storeConfig.name} | ${storeConfig.slogan}`,
    template: `%s | ${storeConfig.name}`,
  },
  description: storeConfig.description,
  openGraph: {
    title: storeConfig.name,
    description: storeConfig.description,
    siteName: storeConfig.name,
    locale: "tr_TR",
    type: "website",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: storeConfig.name,
    description: storeConfig.description,
  },
  robots: {
    follow: true,
    index: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="tr" className={manrope.variable}>
      <body className="bg-neutral-50 text-black selection:bg-teal-300 dark:bg-neutral-900 dark:text-white dark:selection:bg-pink-500 dark:selection:text-white">
        <ConvexClientProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
