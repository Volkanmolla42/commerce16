import type { Metadata } from "next";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { distanceSalesAgreement } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: distanceSalesAgreement.title,
  description: "Mesafeli satış sözleşmesi.",
  robots: { index: false, follow: true },
};

export default function DistanceSalesAgreementPage() {
  return (
    <LegalDocumentLayout
      badge="Yasal Sözleşme"
      title={distanceSalesAgreement.title}
      description="Mesafeli Sözleşmeler Yönetmeliği uyarınca alıcı ve satıcı hakları"
      bodyHtml={distanceSalesAgreement.body}
    />
  );
}
