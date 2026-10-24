import ContentPageLayout from "@/components/layout/content-page-layout";
import { sanitizeHtml } from "@/lib/content/sanitize-html";
import type { ReactNode } from "react";

interface LegalDocumentLayoutProps {
  badge: string;
  title: string;
  description: string;
  bodyHtml: string;
  ready?: boolean;
  version?: string;
  children?: ReactNode;
}

export default function LegalDocumentLayout({
  badge,
  title,
  description,
  bodyHtml,
  ready = true,
  version,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <ContentPageLayout>
      <div className="space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {badge}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">Son güncelleme: 24 Ekim 2026{version ? ` · Sürüm: ${version}` : ""}</p>
        </div>
        {!ready ? (
          <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Satıcı unvanı, adresi, vergi bilgileri ve iletişim bilgileri henüz tamamlanmadığı için bu belge taslaktır.
            Bilgiler tamamlanana kadar sipariş kabul edilmez.
          </div>
        ) : null}
        <div
          className="prose mx-auto max-w-6xl break-words text-base leading-7 text-black prose-headings:mt-8 prose-headings:font-semibold prose-headings:tracking-wide prose-headings:text-black prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg prose-a:text-black prose-a:underline prose-a:hover:text-neutral-600 prose-strong:text-black prose-ol:mt-8 prose-ol:list-decimal prose-ol:pl-6 prose-ul:mt-8 prose-ul:list-disc prose-ul:pl-6 dark:text-white dark:prose-headings:text-white dark:prose-a:text-white dark:prose-a:hover:text-neutral-300 dark:prose-strong:text-white"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
        />
        {children}
      </div>
    </ContentPageLayout>
  );
}
