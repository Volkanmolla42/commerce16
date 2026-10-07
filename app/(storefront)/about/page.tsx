import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description: "Mağazayı ve ürünlerini tanıyın.",
};

export default function AboutPage() {
  return (
    <ContentPageLayout>
      <main className="prose text-foreground dark:prose-invert">
        <h1>Hakkımızda</h1>
        <p>Mağazanın hikâyesini, çalışma biçimini ve müşterilerine sunduğu değeri burada anlatın.</p>
      </main>
    </ContentPageLayout>
  );
}
