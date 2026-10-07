export function FavoritesSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div aria-hidden="true" className="space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
      </div>

      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <li
            key={index}
            className="aspect-square animate-pulse rounded-xl border border-border bg-muted"
          />
        ))}
      </ul>
    </div>
  );
}
