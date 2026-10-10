import type { Metadata } from "next";
import Prose from "@/components/prose";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { preInformationForm } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: preInformationForm.title,
  description: "Ön bilgilendirme formu.",
  robots: { index: false, follow: true },
};

export default function PreInformationFormPage() {
  return (
    <ContentPageLayout>
      <main className="space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Bilgilendirme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {preInformationForm.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Sipariş öncesi tüketici hakları ve ön bilgilendirme koşulları
          </p>
        </div>
        <Prose html={preInformationForm.body} />
      </main>
    </ContentPageLayout>
  );
}
