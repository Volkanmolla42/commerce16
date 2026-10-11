export function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Masaüstü Sol Filtre İskeleti */}
        <aside className="hidden min-w-0 xl:block">
          <div className="sticky top-20 rounded-2xl border border-border bg-card/60 p-5 shadow-none space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
            </div>

            {/* Masaüstü Sıralama ve Kategori İskeleti */}
            <div className="space-y-3 border-b border-border pb-4">
              <div className="space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40 border border-border/60" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40 border border-border/60" />
              </div>
            </div>

            {/* Fiyat Aralığı İskeleti */}
            <div className="border-b border-border pb-4 space-y-2">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted/70" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-11 animate-pulse rounded-xl bg-muted/40 border border-border/60" />
                <div className="h-11 animate-pulse rounded-xl bg-muted/40 border border-border/60" />
              </div>
            </div>

            {/* Beden & Renk İskeleti */}
            <div className="space-y-4">
              <div className="border-b border-border pb-4 space-y-2.5">
                <div className="h-3.5 w-16 animate-pulse rounded bg-muted/70" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-9 w-11 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-9 w-11 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-9 w-11 animate-pulse rounded-lg bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="h-3.5 w-14 animate-pulse rounded bg-muted/70" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 w-16 animate-pulse rounded-full bg-muted/50" />
                  <div className="h-8 w-16 animate-pulse rounded-full bg-muted/50" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Ana Ürün Alanı İskeleti */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          {/* Mobilde Üst Filtre Barı (Masaüstünde xl:hidden) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 xl:hidden">
            <div className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted/50 border border-border/60" />
            <div className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-muted/40 border border-border/60" />
            <div className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-muted/40 border border-border/60" />
          </div>

          {/* Ürün Kartları Grid İskeleti */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
              >
                <div className="relative aspect-[4/5] w-full animate-pulse bg-muted/50">
                  <div className="absolute right-3 top-3 size-8 rounded-full bg-background/50 backdrop-blur-md" />
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-2 p-3 sm:p-3.5">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted/80" />
                    <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted/50" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return <SearchSkeleton />;
}
