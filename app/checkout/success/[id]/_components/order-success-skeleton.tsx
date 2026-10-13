import { Card, CardHeader, CardContent } from "@/components/ui";

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-xl ${className}`} />;
}

function SkLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-md ${className}`} />;
}

export function OrderSuccessSkeleton() {
  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-4 py-8 sm:px-6 sm:py-12 space-y-6" aria-hidden>
      {/* Üst Onay Kartı İskeleti */}
      <Card className="rounded-3xl border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Sk className="size-16 shrink-0 rounded-2xl" />
          <div className="space-y-2.5 flex-1 text-center sm:text-left">
            <SkLine className="h-7 w-64 mx-auto sm:mx-0" />
            <SkLine className="h-4 w-80 mx-auto sm:mx-0" />
            <div className="flex gap-3 justify-center sm:justify-start pt-1">
              <SkLine className="h-4 w-32" />
              <SkLine className="h-4 w-28" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sol Kolon İskeleti */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20 px-6 py-4">
              <SkLine className="h-5 w-44" />
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Sk className="size-16 shrink-0 rounded-2xl" />
                    <div className="space-y-2">
                      <SkLine className="h-4 w-48" />
                      <SkLine className="h-3 w-28" />
                    </div>
                  </div>
                  <SkLine className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-3">
            <SkLine className="h-5 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <SkLine className="h-12 w-full" />
              <SkLine className="h-12 w-full" />
            </div>
          </Card>
        </div>

        {/* Sağ Kolon İskeleti */}
        <div className="lg:col-span-4">
          <Card className="rounded-3xl border-border bg-card p-6 shadow-xs space-y-4">
            <SkLine className="h-5 w-32" />
            <div className="space-y-3 pt-2">
              <SkLine className="h-4 w-full" />
              <SkLine className="h-4 w-full" />
              <SkLine className="h-6 w-full" />
            </div>
            <Sk className="h-12 w-full rounded-2xl" />
          </Card>
        </div>
      </div>
    </div>
  );
}
