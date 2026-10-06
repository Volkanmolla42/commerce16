import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { GeistSans } from "geist/font/sans";
import { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { baseUrl } from "@/lib/utils";
import { getStoreSettings } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, seoTitle, seoDescription } = await getStoreSettings();
  const description =
    seoDescription || storeName + " - Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler.";

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: seoTitle || storeName,
      template: "%s | " + storeName,
    },
    description,
    openGraph: {
      title: storeName,
      description,
      siteName: storeName,
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: storeName,
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
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
