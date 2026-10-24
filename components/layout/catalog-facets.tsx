"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import type { CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import {
  getOptionKind,
  type CatalogFilters,
  type CategoryAttributeFilter,
  type CategoryAttributeFilters,
} from "@/lib/catalog/facets";
import type { CatalogFacetOptions } from "@/lib/catalog/paging";

function CategoryAttributeFacet({
  definition,
  values,
  filter,
  onChange,
}: {
  definition: CategoryAttributeDefinition;
  values: string[];
  filter: CategoryAttributeFilter;
  onChange: (patch: Partial<CategoryAttributeFilter>) => void;
}) {
  const [optionSearch, setOptionSearch] = useState("");
  const visibleValues = values.filter((value) => value.toLocaleLowerCase("tr-TR").includes(optionSearch.toLocaleLowerCase("tr-TR"))).slice(0, 50);
  if (values.length === 0 && definition.type !== "number") return null;
  const numericValues = definition.type === "number"
    ? values.map(Number).filter(Number.isFinite)
    : [];

  return (
    <details className="group border-b border-border py-3 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{definition.label}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {filter.values.length + Number(filter.min !== "") + Number(filter.max !== "") || null}
          <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {definition.type === "number" ? (
        <fieldset className="mt-2 grid grid-cols-2 gap-2">
          <legend className="sr-only">{definition.label} aralığı</legend>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En az{definition.unit ? ` (${definition.unit})` : ""}</span>
            <Input type="number" inputMode="decimal" aria-label={`${definition.label} en az`} placeholder={numericValues.length ? String(Math.min(...numericValues)) : undefined} value={filter.min} onChange={(event) => onChange({ min: event.target.value })} className="min-h-11" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">En çok{definition.unit ? ` (${definition.unit})` : ""}</span>
            <Input type="number" inputMode="decimal" aria-label={`${definition.label} en çok`} placeholder={numericValues.length ? String(Math.max(...numericValues)) : undefined} value={filter.max} onChange={(event) => onChange({ max: event.target.value })} className="min-h-11" />
          </label>
        </fieldset>
      ) : (
        <fieldset className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          <legend className="sr-only">{definition.label}</legend>
          {values.length > 50 ? <Input type="search" aria-label={`${definition.label} seçeneklerinde ara`} placeholder="Seçenek ara" value={optionSearch} onChange={(event) => setOptionSearch(event.target.value)} /> : null}
          {visibleValues.map((value) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-foreground hover:bg-muted">
              <input type="checkbox" checked={filter.values.includes(value)} onChange={() => onChange({
                values: filter.values.includes(value) ? filter.values.filter((item) => item !== value) : [...filter.values, value],
              })} className="size-4 shrink-0 accent-blue-500" />
              <span className="min-w-0 flex-1 break-words">{value === "true" ? "Evet" : value === "false" ? "Hayır" : value}</span>
            </label>
          ))}
        </fieldset>
      )}
    </details>
  );
}

function OptionFacet({
  name,
  values,
  selectedValues,
  onChange,
}: {
  name: string;
  values: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  if (values.length === 0) return null;
  const kind = getOptionKind(name);

  const toggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <details open className="group border-b border-border py-3 last:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{name}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {selectedValues.length > 0 ? `${selectedValues.length} seçili` : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      {kind === "size" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() => toggle(val)}
                className={`h-10 min-w-11 rounded-xl border px-3 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs font-bold"
                    : "border-border/80 bg-muted/20 text-foreground hover:border-foreground/40 hover:bg-muted"
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      ) : kind === "color" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() => toggle(val)}
                className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/15 font-semibold text-primary ring-1 ring-primary/40 shadow-xs"
                    : "border-border/80 bg-muted/20 text-foreground hover:border-foreground/40 hover:bg-muted"
                }`}
              >
                <span className="size-2 rounded-full bg-current opacity-70" />
                <span>{val}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <fieldset className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          <legend className="sr-only">{name}</legend>
          {values.map((val) => {
            const isSelected = selectedValues.includes(val);
            return (
              <label key={val} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-foreground hover:bg-muted">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(val)}
                  className="size-4 shrink-0 accent-blue-500"
                />
                <span className="min-w-0 flex-1 break-words">{val}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </details>
  );
}

export function FacetControls({
  facetOptions,
  categoryAttributes,
  categoryAttributeFilters,
  onCategoryAttributeChange,
  filters,
  inputSuffix,
  onPriceChange,
  onOptionChange,
}: {
  facetOptions: CatalogFacetOptions;
  categoryAttributes: CategoryAttributeDefinition[];
  categoryAttributeFilters: CategoryAttributeFilters;
  onCategoryAttributeChange: (key: string, patch: Partial<CategoryAttributeFilter>) => void;
  filters: CatalogFilters;
  inputSuffix: string;
  onPriceChange: (key: "minPrice" | "maxPrice", value: string) => void;
  onOptionChange: (name: string, values: string[]) => void;
}) {
  return (
    <div>
      <fieldset className="space-y-2 border-b border-border/60 py-3.5">
        <legend className="pb-1 text-sm font-semibold text-foreground">Fiyat aralığı</legend>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">En az (TL)</span>
            <Input
              aria-label="En düşük fiyat"
              placeholder="0"
              className="h-10 text-xs sm:text-sm rounded-xl border-border/80 bg-muted/20 focus:bg-background"
              inputMode="decimal"
              min="0"
              name={`min-price-${inputSuffix}`}
              onChange={(event) => onPriceChange("minPrice", event.target.value)}
              step="0.01"
              type="number"
              value={filters.minPrice}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">En çok (TL)</span>
            <Input
              aria-label="En yüksek fiyat"
              placeholder="9999"
              className="h-10 text-xs sm:text-sm rounded-xl border-border/80 bg-muted/20 focus:bg-background"
              inputMode="decimal"
              min="0"
              name={`max-price-${inputSuffix}`}
              onChange={(event) => onPriceChange("maxPrice", event.target.value)}
              step="0.01"
              type="number"
              value={filters.maxPrice}
            />
          </label>
        </div>
      </fieldset>

      {Object.entries(facetOptions.options ?? {}).map(([name, values]) => (
        <OptionFacet
          key={name}
          name={name}
          values={values}
          selectedValues={filters.options?.[name] ?? []}
          onChange={(newValues) => onOptionChange(name, newValues)}
        />
      ))}

      {categoryAttributes.filter((definition) => definition.type !== "text").map((definition) => (
        <CategoryAttributeFacet
          key={definition.key}
          definition={definition}
          values={facetOptions.attributes[definition.key] ?? []}
          filter={categoryAttributeFilters[definition.key] ?? { values: [], min: "", max: "" }}
          onChange={(patch) => onCategoryAttributeChange(definition.key, patch)}
        />
      ))}

    </div>
  );
}
