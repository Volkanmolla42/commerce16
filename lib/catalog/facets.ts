import type { Product } from "./types";
import type { CategoryAttributeDefinition } from "./attributes";

export type CatalogFilters = {
  minPrice: string;
  maxPrice: string;
  options?: Record<string, string[]>;
};

export type CategoryAttributeFilter = { values: string[]; min: string; max: string };
export type CategoryAttributeFilters = Record<string, CategoryAttributeFilter>;

export function getProductAttributeValue(product: Product, key: string) {
  return product.attributes?.find((attribute) => attribute.key === key)?.value;
}

export function getProductAttributeValues(product: Product, definition: CategoryAttributeDefinition) {
  const value = getProductAttributeValue(product, definition.key);
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export function getCategoryAttributeOptions(products: Product[], definition: CategoryAttributeDefinition) {
  const available = new Set(products.flatMap((product) => getProductAttributeValues(product, definition)));
  return [...available].sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
}

export function matchesCategoryAttributeFilters(
  product: Product,
  definitions: CategoryAttributeDefinition[],
  filters: CategoryAttributeFilters,
) {
  return definitions.every((definition) => {
    const filter = filters[definition.key];
    if (!filter) return true;
    const values = getProductAttributeValues(product, definition);
    if (definition.type === "number") {
      if (filter.values.length > 0) return values.some((value) => filter.values.includes(value));
      const min = filter.min === "" ? null : Number(filter.min);
      const max = filter.max === "" ? null : Number(filter.max);
      if (min === null && max === null) return true;
      return values.some((value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) && (min === null || numericValue >= min) && (max === null || numericValue <= max);
      });
    }
    return filter.values.length === 0 || values.some((value) => filter.values.includes(value));
  });
}

export function getActiveCategoryAttributeFilterCount(filters: CategoryAttributeFilters) {
  return Object.values(filters).reduce((count, filter) => count + filter.values.length + Number(filter.min !== "") + Number(filter.max !== ""), 0);
}

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  minPrice: "",
  maxPrice: "",
  options: {},
};

function getProductPrice(product: Product) {
  const price = Number(product.price);
  return Number.isFinite(price) ? price : null;
}

export function matchesOptionFilters(product: Product, options?: Record<string, string[]>) {
  if (!options) return true;
  const activeEntries = Object.entries(options).filter(([, vals]) => Array.isArray(vals) && vals.length > 0);
  if (activeEntries.length === 0) return true;

  const variants = product.variants ?? [];
  if (variants.length === 0) {
    return activeEntries.every(([name, selectedValues]) => {
      const opt = product.options?.find(
        (o) => o.name.trim().toLocaleLowerCase("tr-TR") === name.trim().toLocaleLowerCase("tr-TR")
      );
      return opt ? opt.values.some((val) => selectedValues.includes(val)) : false;
    });
  }

  // A product matches if it has at least one in-stock / available variant matching every selected option dimension
  return variants.some((variant) => {
    if (variant.availableForSale === false) return false;
    const rawStock = (variant as unknown as { stockQuantity?: number }).stockQuantity;
    if (typeof rawStock === "number" && rawStock <= 0) return false;

    return activeEntries.every(([name, selectedValues]) => {
      const match = variant.selectedOptions.find(
        (so) => so.name.trim().toLocaleLowerCase("tr-TR") === name.trim().toLocaleLowerCase("tr-TR")
      );
      return match ? selectedValues.includes(match.value) : false;
    });
  });
}

export function matchesCatalogFilters(product: Product, filters: CatalogFilters) {
  const price = getProductPrice(product);
  const minPrice = filters.minPrice === "" ? null : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === "" ? null : Number(filters.maxPrice);

  if (minPrice !== null && (price === null || price < minPrice)) return false;
  if (maxPrice !== null && (price === null || price > maxPrice)) return false;

  if (!matchesOptionFilters(product, filters.options)) return false;

  return true;
}

export function getActiveCatalogFilterCount(filters: CatalogFilters) {
  const optionsCount = filters.options
    ? Object.values(filters.options).reduce((sum, vals) => sum + (Array.isArray(vals) ? vals.length : 0), 0)
    : 0;
  return (
    Number(filters.minPrice !== "") +
    Number(filters.maxPrice !== "") +
    optionsCount
  );
}

export type OptionKind = "size" | "color" | "general";

const SIZE_OPTION_REGEX = /^(beden|size|numara|boyut|ebat)$/i;
const COLOR_OPTION_REGEX = /^(renk|color)$/i;

export function getOptionKind(name: string): OptionKind {
  const normalized = name.trim();
  if (SIZE_OPTION_REGEX.test(normalized)) return "size";
  if (COLOR_OPTION_REGEX.test(normalized)) return "color";
  return "general";
}

export const STANDARD_SIZES = [
  "xxs", "xs", "s", "m", "l", "xl", "2xl", "xxl", "3xl", "xxxl", "4xl", "5xl",
];

export function sortOptionValues(name: string, values: string[]): string[] {
  const kind = getOptionKind(name);
  if (kind === "size") {
    const isAllNumeric = values.every((v) => Number.isFinite(Number(v)));
    if (isAllNumeric) {
      return [...values].sort((a, b) => Number(a) - Number(b));
    }
    return [...values].sort((a, b) => {
      const idxA = STANDARD_SIZES.indexOf(a.trim().toLowerCase());
      const idxB = STANDARD_SIZES.indexOf(b.trim().toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
    });
  }
  return [...values].sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }));
}
