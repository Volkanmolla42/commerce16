"use client";

import clsx from "clsx";
import { canSelectOption, hasVariantOptionCombination } from "@/lib/catalog/variants";
import { ProductOption, ProductVariant } from "@/lib/catalog/types";
import { useRouter, useSearchParams } from "next/navigation";

export function VariantSelector({
  options,
  variants,
}: {
  options: ProductOption[];
  variants: ProductVariant[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasNoOptionsOrJustOneOption =
    !options.length ||
    (options.length === 1 && options[0]?.values.length === 1);

  if (hasNoOptionsOrJustOneOption) {
    return null;
  }

  const updateOption = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const key = name.toLocaleLowerCase("tr-TR");
    params.set(key, value);
    for (const option of options) {
      const optionKey = option.name.toLocaleLowerCase("tr-TR");
      const selected = params.get(optionKey);
      if (optionKey !== key && selected && !hasVariantOptionCombination({ options, variants }, params, option.name, selected)) {
        params.delete(optionKey);
      }
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return options.map((option) => (
    <div key={option.id}>
      <dl className="mb-6">
        <dt className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {option.name}
          {searchParams.get(option.name.toLocaleLowerCase("tr-TR")) ? `: ${searchParams.get(option.name.toLocaleLowerCase("tr-TR"))}` : ""}
        </dt>
        <dd className="flex flex-wrap gap-2">
          {option.values.map((value) => {
            const optionNameLowerCase = option.name.toLocaleLowerCase("tr-TR");

            const isAvailableForSale = canSelectOption({ options, variants }, searchParams, option.name, value);
            const hasCombination = hasVariantOptionCombination({ options, variants }, searchParams, option.name, value);

            // The option is active if it's in the selected options.
            const selectedOption = searchParams.get(optionNameLowerCase);
            const isActive = selectedOption === value || (!selectedOption && option.values.length === 1);

            return (
              <button
                type="button"
                onClick={() => updateOption(optionNameLowerCase, value)}
                aria-pressed={isActive}
                aria-label={`${option.name}: ${value}${!isAvailableForSale ? ", tükendi" : ""}`}
                key={value}
                aria-disabled={!hasCombination}
                disabled={!hasCombination}
                title={`${option.name} ${value}${!isAvailableForSale ? " (Tükendi)" : ""}`}
                className={clsx(
                  "flex min-h-11 min-w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
                  {
                    "border-rose-300 bg-rose-300 text-neutral-950": isActive,
                    "hover:border-neutral-500 dark:hover:border-neutral-400": !isActive && isAvailableForSale,
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
  ));
}
