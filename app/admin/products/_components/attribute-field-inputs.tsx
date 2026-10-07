"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { type CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import { ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

export function AttributeMultiSelect({
  attribute,
  value = [],
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const options = useMemo(() => attribute.options ?? [], [attribute.options]);
  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return options.filter((opt) => opt.toLocaleLowerCase("tr-TR").includes(q));
  }, [options, search]);

  const toggle = (option: string) => {
    if (selectedSet.has(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const removeOption = (option: string) => {
    onChange(value.filter((item) => item !== option));
  };

  const selectAll = () => {
    onChange([...options]);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">
          {value.length > 0 && (
            <span className="font-medium text-neutral-200">
              {value.length} / {options.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {options.length > 1 && value.length < options.length && (
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
            >
              Tümü
            </button>
          )}
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-red-400 hover:text-red-300"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <div role="list" aria-label="Seçilen değerler" className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((item) => (
            <span
              key={item}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-900"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeOption(item)}
                className="inline-flex size-4 items-center justify-center rounded hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                aria-label={`${item} seçimini kaldır`}
              >
                <XMarkIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {options.length > 5 && (
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            autoComplete="off"
            spellCheck={false}
            aria-label={`${attribute.label} seçeneklerinde ara`}
            className="h-8 w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-2.5 pr-8 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-500/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              aria-label="Aramayı temizle"
            >
              <XMarkIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div role="group" aria-label={`${attribute.label} seçenek listesi`} className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {filteredOptions.map((option) => {
          const isSelected = selectedSet.has(option);
          return (
            <button
              key={option}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => toggle(option)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                isSelected
                  ? "border-neutral-300 bg-neutral-100 text-neutral-950 font-semibold shadow-xs"
                  : "border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isSelected ? "bg-neutral-950" : "bg-neutral-600"
                }`}
              />
              {option}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <p role="status" className="text-xs text-neutral-500 py-1">Sonuç yok</p>
        )}
      </div>
    </div>
  );
}

export function AttributeSingleSelect({
  attribute,
  value = "",
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string;
  onChange: (next: string) => void;
}) {
  const options = attribute.options ?? [];

  return (
    <div className="relative flex items-center">
      <select
        id={`product-attribute-${attribute.key}`}
        aria-label={attribute.label}
        required={attribute.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-900 pl-3 pr-8 text-sm text-neutral-100 outline-none transition focus:border-neutral-500 focus-visible:ring-2 focus-visible:ring-neutral-400/30"
      >
        <option value="">Seçin</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {value && !attribute.required && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-7 inline-flex size-6 items-center justify-center rounded text-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          aria-label={`${attribute.label} seçimini temizle`}
        >
          <XMarkIcon className="size-3.5" />
        </button>
      )}
      <div className="pointer-events-none absolute right-2.5 text-neutral-400">
        <ChevronUpDownIcon className="size-4" />
      </div>
    </div>
  );
}

export function AttributeBooleanToggle({
  attribute,
  value,
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={attribute.label}
      className="flex h-11 items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "true"}
        onClick={() => onChange("true")}
        className={`flex-1 h-full rounded-md text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
          value === "true"
            ? "bg-neutral-200 text-neutral-900 font-semibold shadow-xs"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        Evet
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "false"}
        onClick={() => onChange("false")}
        className={`flex-1 h-full rounded-md text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
          value === "false"
            ? "bg-neutral-200 text-neutral-900 font-semibold shadow-xs"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        Hayır
      </button>
      {!attribute.required && value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-2 text-[11px] text-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          aria-label={`${attribute.label} seçimini sıfırla`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function AttributeNumberInput({
  attribute,
  value = "",
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative flex items-center">
      <Input
        id={`product-attribute-${attribute.key}`}
        aria-label={attribute.label}
        type="number"
        inputMode="decimal"
        required={attribute.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border-neutral-700 bg-neutral-900 pr-12 text-sm text-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400/30"
        placeholder="0"
      />
      {attribute.unit && (
        <span className="pointer-events-none absolute right-3 rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-neutral-400">
          {attribute.unit}
        </span>
      )}
    </div>
  );
}
