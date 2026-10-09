import type { Category, Menu, Product } from "./types";
import { fetchQuery } from "convex/nextjs";
import { cacheTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import { getProductSearchFields, rankSearchItems } from "./smart-search";
import { getSimilarProducts } from "./recommendations";
import { formatProduct } from "./format-product";
import { getProductImages } from "./product-images";

type ProductFilters = {
  category?: string;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
};

export type StoreSettings = {
  storeName: string;
  slogan: string;
  logoUrl: string;
  logoStorageId: string | null;
  phone: string;
  email: string;
  address: string;
  announcement: string;
  isOpen: boolean;
};

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag("store-settings");
  return await fetchQuery(api.settings.getStoreSettings, {});
}

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  // ponytail: keep fuzzy matching inside the existing 100-product window; add indexed search if that limit grows.
  const items = await fetchQuery(api.products.list, { limit: 100, ...(filters.category ? { categorySlug: filters.category } : {}) });
  const mapped = items.map(formatProduct);

  const query = filters.query?.trim();
  const result = query
    ? rankSearchItems(mapped, query, getProductSearchFields)
    : mapped;

  if (filters.sortKey === "PRICE") {
    result.sort((a, b) => Number(a.price) - Number(b.price));
  }

  return filters.reverse ? result.reverse() : result;
}

export async function getSitemapProducts() {
  "use cache";
  cacheTag("products");
  const products: { slug: string; updatedAt: string }[] = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone) {
    const result: {
      page: { slug: string; updatedAt: string }[];
      continueCursor: string;
      isDone: boolean;
    } = await fetchQuery(api.products.listForSitemap, { cursor });
    products.push(...result.page);
    cursor = result.continueCursor;
    isDone = result.isDone;
  }

  return products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheTag("products");
  const item = await fetchQuery(api.products.getBySlug, { slug });
  if (!item) return undefined;
  return formatProduct(item);
}

export async function getProductRecommendations(product: Product): Promise<Product[]> {
  const all = await getProducts();
  return getSimilarProducts(product, all);
}

export async function getRecommendationCatalog(limit = 100): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit).map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    availableForSale: product.availableForSale,
    attributes: product.attributes,
    categorySlug: product.categorySlug,
    images: getProductImages(product).slice(0, 1),
    updatedAt: product.updatedAt,
  }));
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("categories");
  const items = await fetchQuery(api.categories.list, {});
  const dynamicCategories: Category[] = (items || []).map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    path: `/search/${c.slug}`,
    seo: { title: c.title, description: c.description || `${c.title} ürünleri` },
    updatedAt: c.updatedAt,
    imageUrl: c.imageUrl,
    attributes: c.attributes,
  }));

  return [
    {
      slug: "",
      title: "Tümü",
      description: "Tüm ürünler",
      seo: {
        title: "Tümü",
        description: "Tüm ürünler",
      },
      path: "/search",
      updatedAt: dynamicCategories.map((category) => category.updatedAt).sort().at(-1) ?? "1970-01-01T00:00:00.000Z",
    },
    ...dynamicCategories,
  ];
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
  cacheTag("categories");
  const item = await fetchQuery(api.categories.getBySlug, { slug });
  if (!item) return undefined;
  return {
    slug: item.slug,
    title: item.title,
    description: item.description,
    path: `/search/${item.slug}`,
    seo: { title: item.title, description: item.description || `${item.title} ürünleri` },
    updatedAt: item.updatedAt,
    attributes: item.attributes,
  };
}

export async function getCategoryProducts({
  category,
  ...filters
}: ProductFilters & { category: string }): Promise<Product[]> {
  return getProducts({ ...filters, category });
}

export async function getMenu(): Promise<Menu[]> {
  "use cache";
  const categories = await getCategories();
  return categories.map((c) => ({
    title: c.title,
    path: c.path,
  }));
}
