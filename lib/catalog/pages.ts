import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAdminBackend } from "@/lib/admin/backend";
import { CATALOG_PAGE_SIZE, param, readCatalogFilters, type CatalogSearchParams } from "./paging";

function pageArguments(params: CatalogSearchParams, categorySlug?: string) {
  const { filters, attributes } = readCatalogFilters(params);
  return {
    rawFilters: filters,
    rawAttributes: attributes,
    queryArgs: {
      paginationOpts: { numItems: CATALOG_PAGE_SIZE, cursor: param(params, "cursor") || null, maximumRowsRead: 128, maximumBytesRead: 2 * 1024 * 1024 },
      query: param(params, "q"),
      sort: param(params, "sort"),
      filters: {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        options: Object.entries(filters.options ?? {}).map(([name, values]) => ({ name, values })),
      },
      attributes: Object.entries(attributes).map(([key, filter]) => ({ key, ...filter })),
      ...(categorySlug === undefined ? {} : { categorySlug }),
    },
  };
}

export async function getCatalogPage(params: CatalogSearchParams, categorySlug?: string) {
  "use cache";
  cacheTag("products", "categories");
  // Sipariş kaynaklı stok değişimi tag'i invalidate etmiyor; bu pencere listeleme için tazelik sınırı.
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const { queryArgs, rawFilters, rawAttributes } = pageArguments(params, categorySlug);
  const [result, rawAttributesList, rawOptionsList] = await Promise.all([
    fetchQuery(api.catalog.page, queryArgs),
    categorySlug === undefined ? Promise.resolve([]) : fetchQuery(api.catalog.facets, { categorySlug }),
    fetchQuery(api.catalog.optionFacets, { categorySlug }),
  ]);
  const attributes = Object.fromEntries(rawAttributesList.map((item) => [item.key, item.values]));
  const options = Object.fromEntries(rawOptionsList.map((item) => [item.name, item.values]));
  return {
    products: result.page,
    continueCursor: result.continueCursor,
    isDone: result.isDone,
    facets: { attributes, options },
    filters: rawFilters,
    attributeFilters: rawAttributes,
  };
}

export async function getAdminProductPage(params: CatalogSearchParams) {
  const { client, adminSecret } = getAdminBackend();
  const category = param(params, "category");
  const availability = param(params, "availability");
  const { queryArgs } = pageArguments(params, category && category !== "all" ? category : undefined);
  const result = await client.query(api.catalog.page, {
    ...queryArgs,
    adminSecret,
    availability: availability === "active" || availability === "inactive" ? availability : "all",
  });
  return { items: result.page.map(({ id, ...item }) => ({ _id: id, ...item, images: item.images.map(({ url }) => url) })),
    continueCursor: result.continueCursor, isDone: result.isDone };
}

export async function getAdminProductStats() {
  const { client, adminSecret } = getAdminBackend();
  return client.query(api.catalog.stats, { adminSecret });
}
