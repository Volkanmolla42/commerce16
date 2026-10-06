import { cn } from "@/lib/utils";

export function Sk({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

export function SkLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block animate-pulse rounded bg-muted", className)}
    />
  );
}

export function SkField({
  label,
  bar,
  className,
}: {
  label: string;
  bar: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="block text-muted-foreground">{label}</span>
      <Sk className={cn("mt-1", bar)} />
    </div>
  );
}
