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
      <main>
        <h1 className="mb-8 text-4xl font-semibold">{distanceSalesAgreement.title}</h1>
        <Prose html={distanceSalesAgreement.body} />
      </main>
    </ContentPageLayout>
  );
}
