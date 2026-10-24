import { routes } from "@/lib/storefront-routes";
import LegalDocumentLayout from "@/components/layout/legal-document-layout";
import { CookiePreferencesButton } from "@/components/privacy/cookie-consent-manager";
import { getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments, LEGAL_DOCUMENT_TITLES } from "@/lib/legal-documents";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo, isLegalIdentityConfigured } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: LEGAL_DOCUMENT_TITLES.cookiePolicy,
  description: "Kullanılan çerezler, tarayıcı depolama anahtarları, saklama süreleri ve tercih yönetimi.",
  path: routes.cookiePolicy,
  ...(isLegalIdentityConfigured() ? {} : { robots: { index: false, follow: true } }),
});

export default async function CookiePolicyPage() {
  const policy = getLegalDocuments(getSellerInfo(await getStoreSettings())).cookiePolicy;

  return (
    <LegalDocumentLayout
      badge="Gizlilik"
      title={policy.title}
      description="Çerezler, saklama süreleri ve tercihlerinizi yönetme yolları"
      bodyHtml={policy.body}
      version={policy.version}
      ready={policy.ready}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Çerez tercihlerinizi yönetin</p>
          <p className="mt-1 text-xs text-muted-foreground">Analitik ve pazarlama izinlerinizi dilediğiniz zaman değiştirebilirsiniz.</p>
        </div>
        <CookiePreferencesButton />
      </div>
    </LegalDocumentLayout>
  );
}
