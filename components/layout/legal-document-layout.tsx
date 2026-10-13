import ContentPageLayout from "@/components/layout/content-page-layout";
import Prose from "@/components/prose";

interface LegalDocumentLayoutProps {
  badge: string;
  title: string;
  description: string;
  bodyHtml: string;
}

export default function LegalDocumentLayout({
  badge,
  title,
  description,
  bodyHtml,
}: LegalDocumentLayoutProps) {
  return (
    <ContentPageLayout>
      <main className="space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {badge}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Prose html={bodyHtml} />
      </main>
    </ContentPageLayout>
  );
}
