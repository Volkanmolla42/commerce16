import type { Metadata } from "next";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments } from "@/lib/legal-documents";

export async function generateMetadata(): Promise<Metadata> {
  const agreement = getLegalDocuments(await getStoreSettings()).distanceSalesAgreement;
  return {
    title: agreement.title,
    description: "Mesafeli satış sözleşmesi.",
    robots: { index: false, follow: true },
  };
}

export default async function DistanceSalesAgreementPage() {
  const agreement = getLegalDocuments(await getStoreSettings()).distanceSalesAgreement;

  return (
    <LegalDocumentLayout
      badge="Yasal Sözleşme"
      title={agreement.title}
      description="Mesafeli Sözleşmeler Yönetmeliği uyarınca alıcı ve satıcı hakları"
      bodyHtml={agreement.body}
    />
  );
}
