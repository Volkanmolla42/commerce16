"use client";

import { ArrowPathIcon, CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import type { CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import type { Step } from "../_lib/import-preview";

export function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { label: "Dosya Yükle", desc: "Excel veya CSV seçimi" },
    { label: "Kontrol ve Düzenleme", desc: "Ürün & kategori eşleme" },
    { label: "Sonuç", desc: "Aktarım özeti" },
  ];
  const activeIdx = currentStep === "select" ? 0 : currentStep === "preview" || currentStep === "importing" ? 1 : 2;

  return (
    <div className="flex items-center rounded-2xl border border-border bg-card p-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
        {steps.map((st, idx) => {
          const isDone = idx < activeIdx || (idx === 2 && currentStep === "result");
          const isActive = idx === activeIdx && !(idx === 2 && currentStep === "result");
          return (
            <div key={st.label} className="flex items-center gap-2.5">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "border-2 border-primary bg-primary/10 text-primary font-bold"
                      : "border border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                {isDone ? <CheckIcon className="size-4 stroke-[2.5]" aria-hidden="true" /> : idx + 1}
              </span>
              <div>
                <p className={`text-xs font-medium leading-none ${isActive ? "text-foreground font-semibold" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                  {st.label}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground hidden md:block">{st.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="h-px w-6 sm:w-10 bg-border ml-2" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActionBadge({ exists }: { exists: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1 px-2 py-0 text-[10px] font-medium ${
        exists
          ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      {exists ? (
        <ArrowPathIcon className="size-3" aria-hidden="true" />
      ) : (
        <PlusIcon className="size-3" aria-hidden="true" />
      )}
      {exists ? "Güncellenecek" : "Yeni Ürün"}
    </Badge>
  );
}

export function AttributeEditor({
  attribute,
  value,
  error,
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string | string[] | undefined;
  error?: string;
  onChange: (next: string | string[]) => void;
}) {
  const controlClass = `h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
    error ? "border-amber-500/60 ring-1 ring-amber-500/20" : "border-input hover:border-border focus-visible:border-ring"
  }`;

  if (attribute.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-foreground">
          {attribute.label}
          {attribute.required && <span className="text-destructive font-bold"> *</span>}
        </span>
        <div
          role="group"
          aria-label={attribute.label}
          className={`flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border bg-background p-2 ${
            error ? "border-amber-500/60 ring-1 ring-amber-500/20" : "border-input"
          }`}
        >
          {(attribute.options ?? []).map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? selected.filter((item) => item !== option) : [...selected, option])
                }
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground font-medium shadow-2xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {error && <span className="block text-[11px] leading-4 text-amber-700 dark:text-amber-400 font-medium">{error}</span>}
      </div>
    );
  }

  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">
          {attribute.label}
          {attribute.required && <span className="text-destructive font-bold"> *</span>}
        </span>
        {attribute.unit && (
          <span className="text-[10px] text-muted-foreground font-mono">Birim: {attribute.unit}</span>
        )}
      </div>

      {attribute.type === "boolean" ? (
        <select
          aria-label={attribute.label}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={`${controlClass} cursor-pointer`}
        >
          <option value="">Seçilmedi</option>
          <option value="true">Evet</option>
          <option value="false">Hayır</option>
        </select>
      ) : attribute.type === "select" ? (
        <select
          aria-label={attribute.label}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={`${controlClass} cursor-pointer`}
        >
          <option value="">Seçiniz</option>
          {(attribute.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={attribute.label}
          type={attribute.type === "number" ? "number" : "text"}
          inputMode={attribute.type === "number" ? "decimal" : undefined}
          maxLength={attribute.type === "text" ? 500 : undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={attribute.type === "number" && attribute.unit ? `Örn: 10 ${attribute.unit}` : undefined}
          className={controlClass}
        />
      )}
      {error && <span className="block text-[11px] leading-4 text-amber-700 dark:text-amber-400 font-medium">{error}</span>}
    </label>
  );
}
