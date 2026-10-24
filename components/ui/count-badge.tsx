export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
