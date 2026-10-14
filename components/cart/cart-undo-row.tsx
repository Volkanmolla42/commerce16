"use client";

export function CartUndoRow({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-muted/40 px-5 py-3.5 sm:px-6">
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span> sepetten çıkarıldı
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 text-sm font-semibold text-primary hover:underline"
      >
        Geri al
      </button>
    </div>
  );
}
