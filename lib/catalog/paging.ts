import {
  EMPTY_CATALOG_FILTERS,
  type CatalogFilters, type CategoryAttributeFilters,
} from "./facets";

export const CATALOG_PAGE_SIZE = 24;
export type CatalogFacetOptions = {
  attributes: Record<string, string[]>;
  options?: Record<string, string[]>;
};
export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export function param(params: CatalogSearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function objectParam(value: string): Record<string, unknown> {
  if (!value || value.length > 8192) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function values(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string =>
    typeof item === "string" && item.length <= 200))].slice(0, 100) : [];
}

function numberInput(value: unknown) {
  return typeof value === "string" && value.length <= 32 && value.trim() !== "" && Number.isFinite(Number(value))
    ? value : "";
}

export function readCatalogFilters(params: CatalogSearchParams) {
  const raw = objectParam(param(params, "filters"));
  const rawObj = raw.options;
  const rawOptions: Record<string, unknown> = rawObj && typeof rawObj === "object" && !Array.isArray(rawObj)
    ? (rawObj as Record<string, unknown>)
    : {};
  const options: Record<string, string[]> = {};
  for (const [key, rawValues] of Object.entries(rawOptions)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const cleanValues = values(rawValues);
    if (cleanValues.length > 0) options[key] = cleanValues;
  }

  const filters: CatalogFilters = {
    ...EMPTY_CATALOG_FILTERS,
    minPrice: numberInput(raw.minPrice),
    maxPrice: numberInput(raw.maxPrice),
    options,
  };
  const attributes: CategoryAttributeFilters = {};
  for (const [key, rawFilter] of Object.entries(objectParam(param(params, "attributes"))).slice(0, 100)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (!rawFilter || typeof rawFilter !== "object" || Array.isArray(rawFilter)) continue;
    const filter = rawFilter as Record<string, unknown>;
    attributes[key] = { values: values(filter.values), min: numberInput(filter.min), max: numberInput(filter.max) };
  }
  return { filters, attributes };
}
