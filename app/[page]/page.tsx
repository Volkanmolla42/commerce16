import type { Metadata } from "next";

import Prose from "@/components/prose";
import { getPage } from "@/lib/catalog";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata(props: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = await getPage(params.page);

  if (!page) return notFound();

  return {
    title: page.seo?.title || page.title,
    description: page.seo?.description || page.bodySummary,
    openGraph: {
      publishedTime: page.createdAt,
      modifiedTime: page.updatedAt,
      type: "article",
    },
  };
}

async function PageContent({ params }: { params: Promise<{ page: string }> }) {
  const { page: handle } = await params;
  const page = await getPage(handle);

  if (!page) return notFound();

  return (
    <>
      <h1 className="mb-8 text-5xl font-bold">{page.title}</h1>
      <Prose className="mb-8" html={page.body} />
      <p className="text-sm italic">
        {`Bu belge en son ${new Intl.DateTimeFormat(
          "tr-TR",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        ).format(new Date(page.updatedAt))} tarihinde güncellendi.`}
      </p>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl py-8 animate-pulse">
      <div className="mb-8 h-12 w-2/3 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <div className="space-y-4">
        <div className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-4/6 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

export default function Page(props: { params: Promise<{ page: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent params={props.params} />
    </Suspense>
  );
}
