import type { Metadata } from "next";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { preInformationForm } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: preInformationForm.title,
  description: "Ön bilgilendirme formu.",
  robots: { index: false, follow: true },
};

export default function PreInformationFormPage() {
  return (
    <LegalDocumentLayout
      badge="Yasal Bilgilendirme"
      title={preInformationForm.title}
      description="Sipariş öncesi tüketici hakları ve ön bilgilendirme koşulları"
      bodyHtml={preInformationForm.body}
    />
  );
}
