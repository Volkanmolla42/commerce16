import { routes } from "@/lib/storefront-routes";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments, LEGAL_DOCUMENT_TITLES } from "@/lib/legal-documents";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: LEGAL_DOCUMENT_TITLES.distanceSalesAgreement,
  description: "Mesafeli satış sözleşmesi.",
  path: routes.distanceSalesAgreement,
  robots: { index: false, follow: true },
});

export default async function DistanceSalesAgreementPage() {
  const agreement = getLegalDocuments(getSellerInfo(await getStoreSettings())).distanceSalesAgreement;

  return (
    <LegalDocumentLayout
      badge="Yasal Sözleşme"
      title={agreement.title}
      description="Mesafeli Sözleşmeler Yönetmeliği uyarınca alıcı ve satıcı hakları"
      bodyHtml={agreement.body}
      version={agreement.version}
      ready={agreement.ready}
    />
  );
}
