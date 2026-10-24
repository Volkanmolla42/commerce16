import { routes } from "@/lib/storefront-routes";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments, LEGAL_DOCUMENT_TITLES } from "@/lib/legal-documents";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo, isLegalIdentityConfigured } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: LEGAL_DOCUMENT_TITLES.refundPolicy,
  description: "14 gün cayma hakkı, iade koşulları ve geri ödeme süreci hakkında bilgi alın.",
  path: routes.refundPolicy,
  ...(isLegalIdentityConfigured() ? {} : { robots: { index: false, follow: true } }),
});

export default async function RefundPolicyPage() {
  const policy = getLegalDocuments(getSellerInfo(await getStoreSettings())).refundPolicy;

  return (
    <LegalDocumentLayout
      badge="Tüketici Hakları"
      title={policy.title}
      description="Cayma hakkı, iade koşulları ve geri ödeme süreci"
      bodyHtml={policy.body}
      version={policy.version}
      ready={policy.ready}
    />
  );
}
