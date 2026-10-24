import { routes } from "@/lib/storefront-routes";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments, LEGAL_DOCUMENT_TITLES } from "@/lib/legal-documents";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: LEGAL_DOCUMENT_TITLES.preInformationForm,
  description: "Ön bilgilendirme formu.",
  path: routes.preInformationForm,
  robots: { index: false, follow: true },
});

export default async function PreInformationFormPage() {
  const form = getLegalDocuments(getSellerInfo(await getStoreSettings())).preInformationForm;

  return (
    <LegalDocumentLayout
      badge="Yasal Bilgilendirme"
      title={form.title}
      description="Sipariş öncesi tüketici hakları ve ön bilgilendirme koşulları"
      bodyHtml={form.body}
      version={form.version}
      ready={form.ready}
    />
  );
}
