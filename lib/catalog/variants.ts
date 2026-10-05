import type { Product, ProductVariant } from "./types";

/** A selection is complete only when every option matches one stored variant. */
export function getSelectedVariant(product: Product, params: Pick<URLSearchParams, "get">): ProductVariant | undefined {
  return product.variants?.find((variant) =>
    variant.selectedOptions.length === (product.options?.length ?? 0) &&
    variant.selectedOptions.every(({ name, value }) => {
      const option = product.options?.find((option) => option.name === name);
      const selected = params.get(name.toLowerCase()) ?? (option?.values.length === 1 ? option.values[0] : null);
      return selected === value;
    }),
  );
}

export function canSelectOption(product: Pick<Product, "options" | "variants">, params: Pick<URLSearchParams, "get">, name: string, value: string): boolean {
  return product.variants?.some((variant) => variant.availableForSale &&
    variant.selectedOptions.every((selected) => {
      if (selected.name === name) return selected.value === value;
      const chosen = params.get(selected.name.toLowerCase());
      const option = product.options?.find((option) => option.name === selected.name);
      return !chosen || !option?.values.includes(chosen) || chosen === selected.value;
    }),
  ) ?? false;
}
