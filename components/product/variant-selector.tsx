"use client";

import clsx from "clsx";
import { matchesVariantOption } from "@/lib/catalog/variants";
import { ProductOption, ProductVariant } from "@/lib/catalog/types";
import { useSearchParams } from "next/navigation";

export function VariantSelector({
  options,
  variants,
  selectedVariant,
}: {
  options: ProductOption[];
  variants: ProductVariant[];
  selectedVariant?: ProductVariant;
}) {
  const searchParams = useSearchParams();
  const hasNoOptionsOrJustOneOption =
    !options.length ||
    (options.length === 1 && options[0]?.values.length === 1);

  if (hasNoOptionsOrJustOneOption) {
    return null;
  }

  const selectedValue = (option: ProductOption) =>
    searchParams.get(option.name.toLocaleLowerCase("tr-TR")) ??
    selectedVariant?.selectedOptions.find((selected) => selected.name === option.name)?.value ??
    (option.values.length === 1 ? option.values[0] : null);

  const updateOption = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const key = name.toLocaleLowerCase("tr-TR");
    params.set(key, value);
    for (const option of options) {
      const optionKey = option.name.toLocaleLowerCase("tr-TR");
      const selected = params.get(optionKey);
      if (optionKey !== key && selected && !matchesVariantOption({ options, variants }, params, option.name, selected)) {
        params.delete(optionKey);
      }
    }
    params.delete("image");
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return options.map((option) => {
    const activeValue = selectedValue(option);
    const optionKey = option.name.toLocaleLowerCase("tr-TR");

    return (
      <div key={option.id}>
        <dl className="mb-5">
          <dt className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {option.name}
            {activeValue ? `: ${activeValue}` : ""}
          </dt>
          <dd className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isAvailableForSale = matchesVariantOption({ options, variants }, searchParams, option.name, value, true);
              const hasCombination = matchesVariantOption({ options, variants }, searchParams, option.name, value);
              const isActive = activeValue === value;

              return (
                <button
                  type="button"
                  onClick={() => updateOption(optionKey, value)}
                  aria-pressed={isActive}
                  aria-label={`${option.name}: ${value}${!isAvailableForSale ? ", tükendi" : ""}`}
                  key={value}
                  aria-disabled={!hasCombination}
                  disabled={!hasCombination}
                  title={`${option.name} ${value}${!isAvailableForSale ? " (Tükendi)" : ""}`}
                  className={clsx(
                    "flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    {
                      "border-foreground bg-foreground text-background": isActive,
                      "border-border bg-background text-foreground hover:border-foreground/50": !isActive,
                      "relative overflow-hidden text-neutral-500 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-rotate-12 before:bg-neutral-500": !isAvailableForSale,
                      "cursor-not-allowed opacity-45": !hasCombination,
                    },
                  )}
                >
                  {value}
                </button>
              );
            })}
          </dd>
        </dl>
      </div>
    );
  });
}
