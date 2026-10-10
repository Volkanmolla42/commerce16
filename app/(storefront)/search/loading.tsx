export function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-8">
        {/* Sol Filtre Sidebar Skeleton */}
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-border bg-card p-4 xl:block">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-border pb-4 last:border-0">
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 w-12 animate-pulse rounded-lg bg-muted/60" />
                  <div className="h-8 w-14 animate-pulse rounded-lg bg-muted/60" />
                  <div className="h-8 w-10 animate-pulse rounded-lg bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Sağ İçerik Alanı Skeleton */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Üst Bar: Arama Inputu ve Butonlar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="h-11 w-full max-w-lg animate-pulse rounded-full border border-border bg-muted/40" />
            <div className="flex items-center gap-2.5">
              <div className="h-11 w-28 animate-pulse rounded-full border border-border bg-muted/30" />
              <div className="h-11 w-28 animate-pulse rounded-full border border-border bg-muted/30" />
            </div>
          </div>

          {/* Ürün Izgarası Skeleton (Gerçek kartlarla 1:1 birebir portrait en-boy oranı ve düzen) */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
              >
                {/* 3:4 Dikey Görsel Alanı (Padding yok, tam oturan) */}
                <div className="relative aspect-[3/4] w-full animate-pulse bg-muted/70">
                  {/* Sağ üstteki favori butonu placeholder'ı */}
                  <div className="absolute right-3 top-3 size-9 rounded-full bg-background/40 backdrop-blur-md" />
                </div>

                {/* Alt Metin Alanı (Başlık + Fiyat) */}
                <div className="flex flex-1 flex-col justify-between space-y-3 p-3.5 sm:p-4">
                  <div className="space-y-1.5">
                    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-3/5 animate-pulse rounded bg-muted/80" />
                  </div>
                  <div className="h-5 w-24 animate-pulse rounded bg-muted/70" />
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
  return null;
}
