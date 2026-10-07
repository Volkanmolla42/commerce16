import type { Product } from "./types";
import type { CategoryAttributeDefinition } from "./attributes";

export type ProductFacet = "size" | "color";

export type CatalogFilters = {
  minPrice: string;
  maxPrice: string;
  size: string[];
  color: string[];
  stock: "" | "in" | "out";
  rating: number | null;
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
  size: [],
  color: [],
  stock: "",
  rating: null,
};

const OPTION_NAMES: Record<ProductFacet, string[]> = {
  size: ["beden", "size", "olcu", "boyut"],
  color: ["renk", "color", "colour"],
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function getProductFacetValues(product: Product, facet: ProductFacet) {
  const optionValues = (product.options ?? [])
    .filter((option) => OPTION_NAMES[facet].includes(normalize(option.name)))
    .flatMap((option) => option.values);

  return [
    ...new Set(
      optionValues.filter((value) => Boolean(value.trim())),
    ),
  ];
}

export function getProductFacetOptions(products: Product[], facet: ProductFacet) {
  return [...new Set(products.flatMap((product) => getProductFacetValues(product, facet)))].sort(
    (left, right) => left.localeCompare(right, "tr", { sensitivity: "base" }),
  );
}

function getProductPrice(product: Product) {
  const price = Number(product.price);
  return Number.isFinite(price) ? price : null;
}

export function isProductInStock(product: Product) {
  if (!product.availableForSale || product.stockQuantity === 0) return false;
  if (product.variants?.length) {
    return product.variants.some((variant) => variant.availableForSale);
  }
  return product.availableForSale;
}

export function matchesCatalogFilters(product: Product, filters: CatalogFilters) {
  const price = getProductPrice(product);
  const minPrice = filters.minPrice === "" ? null : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === "" ? null : Number(filters.maxPrice);

  if (minPrice !== null && (price === null || price < minPrice)) return false;
  if (maxPrice !== null && (price === null || price > maxPrice)) return false;

  for (const facet of ["size", "color"] as const) {
    if (
      filters[facet].length > 0 &&
      !getProductFacetValues(product, facet).some((value) => filters[facet].includes(value))
    ) {
      return false;
    }
  }

  if (filters.stock === "in" && !isProductInStock(product)) return false;
  if (filters.stock === "out" && isProductInStock(product)) return false;
  if (filters.rating !== null && (product.rating ?? 0) < filters.rating) return false;

  return true;
}

export function getActiveCatalogFilterCount(filters: CatalogFilters) {
  return (
    Number(filters.minPrice !== "") +
    Number(filters.maxPrice !== "") +
    filters.size.length +
    filters.color.length +
    Number(filters.stock !== "") +
    Number(filters.rating !== null)
  );
}
