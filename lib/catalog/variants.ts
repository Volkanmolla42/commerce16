import type { Product, ProductVariant } from "./types";

export const MAX_CART_QUANTITY = 999;
// Tüm ürünlerin en az bir varyantı olmak zorunda; bu değer yalnızca stockQuantity taşımayan bayat önbellek sepetleri içindir.
export const UNLIMITED_STOCK = MAX_CART_QUANTITY;

type StockVariant = {
  id: string;
  stockQuantity?: number;
  availableForSale: boolean;
};

/** Tek stok kuralı: varyant satışta VE stoğu sıfırdan büyük olmalı. */
export function isVariantSellable(variant: StockVariant): boolean {
  return variant.availableForSale && (variant.stockQuantity ?? 0) > 0;
}

export function getVariantStock(product: { variants?: StockVariant[] }, variantId?: string): number {
  const variant = variantId
    ? product.variants?.find((candidate) => candidate.id === variantId)
    : (product.variants?.length === 1 ? product.variants[0] : undefined);
  return variant?.stockQuantity !== undefined ? Math.max(0, variant.stockQuantity) : UNLIMITED_STOCK;
}

type ProductPriceSource = {
  price?: string;
  priceRange?: { min: string; max: string };
  options?: { name: string; values: string[] }[];
  variants?: {
    price: string | { amount: string };
    selectedOptions?: { name: string; value: string }[];
  }[];
};

function optionQueryKey(name: string) {
  return name.toLocaleLowerCase("tr-TR");
}

export function getProductPriceRange(
  product: ProductPriceSource,
  params?: Pick<URLSearchParams, "get">,
): { min: string; max: string } {
  if (!params && product.priceRange) return product.priceRange;
  const optionVariants = product.variants ?? [];
  const matchingVariants = params && optionVariants.length > 0
    ? optionVariants.filter((variant) => (variant.selectedOptions ?? []).every(({ name, value }) => {
        const selected = params.get(optionQueryKey(name));
        return !selected || selected === value;
      }))
    : optionVariants;
  const candidates = matchingVariants.length > 0 ? matchingVariants : optionVariants;
  const prices = candidates
    .map((variant) => typeof variant.price === "string" ? variant.price : variant.price.amount)
    .map((amount) => ({ amount, value: Number(amount) }))
    .filter(({ value }) => Number.isFinite(value));
  if (prices.length === 0) {
    const amount = product.price ?? "0.00";
    return { min: amount, max: amount };
  }
  prices.sort((left, right) => left.value - right.value);
  return { min: prices[0]!.amount, max: prices[prices.length - 1]!.amount };
}

/** A selection is complete only when every option matches one stored variant. */
export function getSelectedVariant(product: Product, params: Pick<URLSearchParams, "get">): ProductVariant | undefined {
  return product.variants?.find((variant) =>
    variant.selectedOptions.length === (product.options?.length ?? 0) &&
    variant.selectedOptions.every(({ name, value }) => {
      const option = product.options?.find((option) => option.name === name);
      const selected = params.get(optionQueryKey(name)) ?? (option?.values.length === 1 ? option.values[0] : null);
      return selected === value;
    }),
  );
}

export function getProductUnitPrice(product: Product, variantId?: string): string {
  const variant = product.variants?.find((candidate) => candidate.id === variantId) ??
    (!variantId && product.variants?.length === 1 ? product.variants[0] : undefined);
  return variant?.price.amount ?? product.price;
}

export function getProductVariantTitle(productTitle: string, variant?: ProductVariant): string {
  const selections = variant?.selectedOptions.map(({ value }) => value).filter(Boolean) ?? [];
  return selections.length ? `${productTitle} — ${selections.join(" / ")}` : productTitle;
}

export function canSelectOption(product: Pick<Product, "options" | "variants">, params: Pick<URLSearchParams, "get">, name: string, value: string): boolean {
  return product.variants?.some((variant) => variant.availableForSale &&
    variant.selectedOptions.every((selected) => {
      if (selected.name === name) return selected.value === value;
      const chosen = params.get(optionQueryKey(selected.name));
      const option = product.options?.find((option) => option.name === selected.name);
      return !chosen || !option?.values.includes(chosen) || chosen === selected.value;
    }),
  ) ?? false;
}

export function hasVariantOptionCombination(product: Pick<Product, "options" | "variants">, params: Pick<URLSearchParams, "get">, name: string, value: string): boolean {
  return product.variants?.some((variant) =>
    variant.selectedOptions.every((selected) => {
      if (selected.name === name) return selected.value === value;
      const chosen = params.get(optionQueryKey(selected.name));
      const option = product.options?.find((option) => option.name === selected.name);
      return !chosen || !option?.values.includes(chosen) || chosen === selected.value;
    }),
  ) ?? false;
}
