export function FavoritesSkeleton() {
  return (
    <div aria-busy="true">
      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
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
