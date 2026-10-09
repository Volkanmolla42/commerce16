import { Suspense } from "react";
import { RestockUnsubscribe } from "@/components/product/restock-unsubscribe";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stok bildirimleri",
  robots: { index: false, follow: false },
};

type RestockUnsubscribePageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default function RestockUnsubscribePage({
  searchParams,
}: RestockUnsubscribePageProps) {
  return (
    <Suspense fallback={<RestockUnsubscribeFallback />}>
      <RestockUnsubscribeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RestockUnsubscribeContent({
  searchParams,
}: RestockUnsubscribePageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <RestockUnsubscribe token={token} />;
}

function RestockUnsubscribeFallback() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:py-24">
      <div
        role="status"
        className="rounded-2xl border border-border bg-background p-6 text-center text-sm text-muted-foreground shadow-sm sm:p-8"
      >
        Bağlantı hazırlanıyor…
      </div>
    </main>
  );
}
