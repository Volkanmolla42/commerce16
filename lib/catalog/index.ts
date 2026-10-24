import type { FunctionReturnType } from "convex/server";
import { routes } from "../storefront-routes";
import type { Category, Menu, Product } from "./types";
import { fetchQuery } from "convex/nextjs";
import { cacheTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import { getSimilarProducts } from "./recommendations";

type CategorySource = {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  imageUrl?: string | null;
  attributes?: Category["attributes"];
};

function toCategory(item: CategorySource): Category {
  return {
    slug: item.slug,
    title: item.title,
    description: item.description,
    path: routes.category(item.slug),
    seo: { title: item.title, description: item.description || `${item.title} ürünleri` },
    updatedAt: item.updatedAt,
    imageUrl: item.imageUrl,
    attributes: item.attributes,
  };
}

async function collectPages<T>(
  fetchPage: (cursor: string | null) => Promise<{ page: T[]; continueCursor: string; isDone: boolean }>,
) {
  const items: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const result = await fetchPage(cursor);
    items.push(...result.page);
    if (result.isDone) return items;
    cursor = result.continueCursor;
  }
}

export type StoreSettings = FunctionReturnType<typeof api.settings.getStoreSettings>;

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag("store-settings");
  return await fetchQuery(api.settings.getStoreSettings, {});
}

async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  return await fetchQuery(api.products.list, { limit: 100 });
}

export async function getSitemapProducts() {
  "use cache";
  cacheTag("products");
  return await collectPages((cursor) => fetchQuery(api.products.listForSitemap, { cursor }));
}

export async function getGoogleShoppingProducts(): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  return await collectPages((cursor) =>
    fetchQuery(api.products.listForGoogleShoppingFeed, {
      paginationOpts: { numItems: 100, cursor },
    }),
  );
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheTag("products");
  return (await fetchQuery(api.products.getBySlug, { slug })) ?? undefined;
}

export async function getProductRecommendations(product: Product): Promise<Product[]> {
  const all = await getProducts();
  return getSimilarProducts(product, all);
}

export async function getRecommendationCatalog(limit = 100): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("categories");
  const items = await fetchQuery(api.categories.list, {});
  const dynamicCategories: Category[] = (items || []).map(toCategory);

  return [
    {
      slug: "",
      title: "Tüm Ürünler",
      description: "Tüm ürünler",
      seo: {
        title: "Tüm Ürünler",
        description: "Tüm ürünler",
      },
      path: routes.search,
      updatedAt: dynamicCategories.map((category) => category.updatedAt).sort().at(-1) ?? "1970-01-01T00:00:00.000Z",
    },
    ...dynamicCategories,
  ];
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
  cacheTag("categories");
  const item = await fetchQuery(api.categories.getBySlug, { slug });
  return item ? toCategory(item) : undefined;
}

export async function getMenu(): Promise<Menu[]> {
  "use cache";
  const categories = await getCategories();
  return categories.map((c) => ({
    title: c.title,
    path: c.path,
  }));
}
