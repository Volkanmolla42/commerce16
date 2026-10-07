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
      <main>
        <h1 className="mb-8 text-4xl font-semibold">{preInformationForm.title}</h1>
        <Prose html={preInformationForm.body} />
      </main>
    </ContentPageLayout>
  );
}
