import type { Metadata } from "next";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments } from "@/lib/legal-documents";

export async function generateMetadata(): Promise<Metadata> {
  const form = getLegalDocuments(await getStoreSettings()).preInformationForm;
  return {
    title: form.title,
    description: "Ön bilgilendirme formu.",
    robots: { index: false, follow: true },
  };
}

export default async function PreInformationFormPage() {
  const form = getLegalDocuments(await getStoreSettings()).preInformationForm;

  return (
    <LegalDocumentLayout
      badge="Yasal Bilgilendirme"
      title={form.title}
      description="Sipariş öncesi tüketici hakları ve ön bilgilendirme koşulları"
      bodyHtml={form.body}
    />
  );
}
