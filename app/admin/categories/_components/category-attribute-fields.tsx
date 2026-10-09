"use client";

import { useId } from "react";
import { Input, Label } from "@/components/ui";
import { ATTRIBUTE_TYPES, isChoiceAttribute, type CategoryAttributeTemplate, type CategoryAttributeType } from "@/lib/catalog/attributes";
import { CategoryAttributeOptionsInput } from "./category-attribute-options-input";

export function CategoryAttributeFields({ value, onChange, disabled = false, required = true, autoFocus = false }: {
  value: CategoryAttributeTemplate;
  onChange: (patch: Partial<CategoryAttributeTemplate>) => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2">
    <legend className="sr-only">Özellik bilgileri</legend>
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-label`}>Özellik adı</Label>
      <Input id={`${id}-label`} value={value.label} required={required} maxLength={80} autoFocus={autoFocus}
        onChange={(event) => onChange({ label: event.target.value })} placeholder="Örn. Malzeme" />
    </div>
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`${id}-type`}>Tür</Label>
      <div className="flex flex-wrap items-center gap-2">
        <select id={`${id}-type`} value={value.type} onChange={(event) => {
          const type = event.target.value as CategoryAttributeType;
          onChange({ type, options: isChoiceAttribute(type) ? value.options ?? [] : undefined, unit: type === "number" ? value.unit : undefined });
        }} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {Object.entries(ATTRIBUTE_TYPES).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
        </select>
        <label className="flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap text-sm">
          <input type="checkbox" checked={value.required} onChange={(event) => onChange({ required: event.target.checked })} className="size-4 accent-foreground" />
          Zorunlu
        </label>
      </div>
    </div>
    {isChoiceAttribute(value.type) && <div className="sm:col-span-2">
      <CategoryAttributeOptionsInput options={value.options ?? []} onChange={(options) => onChange({ options })} disabled={disabled} />
    </div>}
    {value.type === "number" && <div className="space-y-1.5">
      <Label htmlFor={`${id}-unit`}>Birim (isteğe bağlı)</Label>
      <Input id={`${id}-unit`} value={value.unit ?? ""} maxLength={20} onChange={(event) => onChange({ unit: event.target.value })} placeholder="Örn. cm" />
    </div>}
  </fieldset>;
}
