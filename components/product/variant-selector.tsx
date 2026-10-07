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
      <dl className="mb-8">
        <dt className="mb-4 text-sm uppercase tracking-wide">{option.name}{searchParams.get(option.name.toLocaleLowerCase("tr-TR")) ? `: ${searchParams.get(option.name.toLocaleLowerCase("tr-TR"))}` : ""}</dt>
        <dd className="flex flex-wrap gap-3">
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
                  "flex min-w-[48px] items-center justify-center rounded-full border bg-neutral-100 px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900",
                  {
                    "cursor-default ring-2 ring-blue-600": isActive,
                    "ring-1 ring-transparent transition duration-300 ease-in-out hover:ring-blue-600":
                      !isActive && isAvailableForSale,
                    "relative z-10 cursor-pointer overflow-hidden bg-neutral-100 text-neutral-500 ring-1 ring-neutral-300 before:absolute before:inset-x-0 before:-z-10 before:h-px before:-rotate-45 before:bg-neutral-300 before:transition-transform dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700 dark:before:bg-neutral-700":
                      !isAvailableForSale,
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
