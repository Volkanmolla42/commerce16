import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description: "Mağazanın kullanım ve satış koşulları.",
};

export default function TermsConditionsPage() {
  return (
    <ContentPageLayout>
      <main className="prose text-foreground dark:prose-invert">
        <h1>Kullanım Koşulları</h1>
        <p>Mağazanın kullanım ve satış koşullarını bu sayfada düzenleyin.</p>
      </main>
    </ContentPageLayout>
  );
}
