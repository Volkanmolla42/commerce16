import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { GeistSans } from "geist/font/sans";
import { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { baseUrl } from "@/lib/utils";
import { getStoreSettings } from "@/lib/catalog";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, slogan } = await getStoreSettings();
  const title = storeName;
  const description = slogan.trim() || `${storeName} ürünlerini ve koleksiyonlarını keşfedin.`;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: "%s | " + storeName,
    },
    description,
    openGraph: {
      title,
      description,
      siteName: storeName,
      locale: "tr_TR",
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      follow: true,
      index: true,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="tr" className={GeistSans.variable}>
      <body className="bg-neutral-50 text-black selection:bg-teal-300 dark:bg-neutral-900 dark:text-white dark:selection:bg-pink-500 dark:selection:text-white">
        <ConvexClientProvider>
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
