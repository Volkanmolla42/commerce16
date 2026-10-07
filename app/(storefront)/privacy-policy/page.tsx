import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: "Kişisel verilerin işlenmesi hakkında bilgi.",
};

export default function PrivacyPolicyPage() {
  return (
    <ContentPageLayout>
      <main className="prose text-foreground dark:prose-invert">
        <h1>Gizlilik Politikası</h1>
        <p>İşlenen kişisel verileri, işleme amaçlarını, paylaşım biçimlerini ve saklama sürelerini burada açıklayın.</p>
      </main>
    </ContentPageLayout>
  );
}
