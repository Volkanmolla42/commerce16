"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { createUrl } from "@/lib/utils";

export function CatalogPagination({ continueCursor, isDone, count }: { continueCursor: string; isDone: boolean; count: number }) {
  const pathname = usePathname() ?? "/search";
  const searchParams = useSearchParams();
  const [previousPages, setPreviousPages] = useState(() => new Map<string, string>());
  const cursor = searchParams.get("cursor");
  const params = new URLSearchParams(searchParams.toString());
  params.delete("cursor");
  params.delete("page");
  const firstPage = createUrl(pathname, params);
  const previous = cursor ? previousPages.get(cursor) : undefined;
  params.set("cursor", continueCursor);
  const nextPage = createUrl(pathname, params);
  if (!cursor && isDone) return null;
  return (
    <nav aria-label="Ürün sayfaları" className="mt-6 flex items-center justify-between gap-3">
      {cursor ? <Button asChild variant="outline"><Link prefetch={false} href={previous ?? firstPage}>{previous ? "Önceki" : "İlk sayfa"}</Link></Button>
        : <Button variant="outline" disabled>Önceki</Button>}
      <span aria-live="polite" className="text-sm text-muted-foreground">Bu sayfada {count} ürün</span>
      {!isDone ? <Button asChild variant="outline"><Link prefetch={false} href={nextPage} onClick={() => {
        setPreviousPages((current) => new Map(current).set(continueCursor, createUrl(pathname, new URLSearchParams(searchParams.toString()))));
      }}>Sonraki</Link></Button> : <Button variant="outline" disabled>Sonraki</Button>}
    </nav>
  );
}
