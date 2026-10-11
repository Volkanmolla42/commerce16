import {
  getActiveCatalogFilterCount,
  getActiveCategoryAttributeFilterCount,
  type CatalogFilters,
  type CategoryAttributeFilters,
} from "./facets";

export function createCatalogSearchParams(
  search: string,
  filters: CatalogFilters,
  attributes: CategoryAttributeFilters,
  query?: string,
) {
  const params = new URLSearchParams(search);
  params.delete("page");
  params.delete("cursor");

  if (getActiveCatalogFilterCount(filters)) params.set("filters", JSON.stringify(filters));
  else params.delete("filters");
  if (getActiveCategoryAttributeFilterCount(attributes)) params.set("attributes", JSON.stringify(attributes));
  else params.delete("attributes");

  if (query !== undefined) {
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
  }

  return params;
}
