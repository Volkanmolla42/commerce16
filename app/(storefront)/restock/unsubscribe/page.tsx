import { RestockUnsubscribe } from "@/components/product/restock-unsubscribe";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stok bildirimleri",
  robots: { index: false, follow: false },
};

export default async function RestockUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <RestockUnsubscribe token={token} />;
}
