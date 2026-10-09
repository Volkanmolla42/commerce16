import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAdminBackend } from "@/lib/admin/backend";
import { CATALOG_PAGE_SIZE, param, readCatalogFilters, type CatalogSearchParams } from "./paging";

function pageArguments(params: CatalogSearchParams, categorySlug?: string) {
  const { filters, attributes } = readCatalogFilters(params);
  return {
    paginationOpts: { numItems: CATALOG_PAGE_SIZE, cursor: param(params, "cursor") || null, maximumRowsRead: 128, maximumBytesRead: 2 * 1024 * 1024 },
    query: param(params, "q"), sort: param(params, "sort"), filters, attributes,
    ...(categorySlug === undefined ? {} : { categorySlug }),
  };
}

export async function getCatalogPage(params: CatalogSearchParams, categorySlug?: string) {
  "use cache";
  cacheTag("products", "categories");
  cacheLife({ stale: 0, revalidate: 30, expire: 60 });
  const args = pageArguments(params, categorySlug);
  const [result, attributes] = await Promise.all([
    fetchQuery(api.catalog.page, args),
    categorySlug === undefined ? Promise.resolve({}) : fetchQuery(api.catalog.facets, { categorySlug }),
  ]);
  return { products: result.page, continueCursor: result.continueCursor, isDone: result.isDone,
    facets: { attributes },
    filters: args.filters, attributeFilters: args.attributes };
}

export async function getAdminProductPage(params: CatalogSearchParams) {
  const { client, adminSecret } = getAdminBackend();
  const category = param(params, "category");
  const availability = param(params, "availability");
  const result = await client.query(api.catalog.page, {
    ...pageArguments(params, category && category !== "all" ? category : undefined), adminSecret,
    availability: availability === "active" || availability === "inactive" ? availability : "all",
  });
  return { items: result.page.map(({ id, ...item }) => ({ _id: id, ...item, images: item.images.map(({ url }) => url) })),
    continueCursor: result.continueCursor, isDone: result.isDone };
}

export async function getAdminProductStats() {
  const { client, adminSecret } = getAdminBackend();
  return client.query(api.catalog.stats, { adminSecret });
}
