import { Navbar } from "@/components/layout/navbar";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { GeistSans } from "geist/font/sans";
import { ReactNode } from "react";
import "./globals.css";
import { baseUrl } from "@/lib/utils";

const SITE_NAME = process.env.SITE_NAME || "Commerce";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${SITE_NAME} - Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler.`,
  openGraph: {
    title: SITE_NAME,
    description: `${SITE_NAME} - Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler.`,
    siteName: SITE_NAME,
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: `${SITE_NAME} - Yüksek kaliteli tasarım ürünleri ve seçkin kategoriler.`,
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
    <html lang="tr" className={GeistSans.variable}>
      <body className="bg-neutral-50 text-black selection:bg-teal-300 dark:bg-neutral-900 dark:text-white dark:selection:bg-pink-500 dark:selection:text-white">
        <ConvexClientProvider>
          <Navbar />
          <main>{children}</main>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
