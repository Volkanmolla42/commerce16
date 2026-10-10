export function SearchSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-36 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
          >
            <div className="aspect-square w-full animate-pulse bg-muted" />
            <div className="space-y-2 p-3 sm:p-4">
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return <SearchSkeleton />;
}
