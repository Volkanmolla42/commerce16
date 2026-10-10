import type { Metadata } from "next";
import Prose from "@/components/prose";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { distanceSalesAgreement } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: distanceSalesAgreement.title,
  description: "Mesafeli satış sözleşmesi.",
  robots: { index: false, follow: true },
};

export default function DistanceSalesAgreementPage() {
  return (
    <ContentPageLayout>
      <main className="space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Sözleşme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {distanceSalesAgreement.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mesafeli Sözleşmeler Yönetmeliği uyarınca alıcı ve satıcı hakları
          </p>
        </div>
        <Prose html={distanceSalesAgreement.body} />
      </main>
    </ContentPageLayout>
  );
}
