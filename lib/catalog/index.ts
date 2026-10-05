import type { Category, Menu, Page, Product } from "./types";
import type { Doc } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cacheTag } from "next/cache";
import { api } from "@/convex/_generated/api";

type ProductFilters = {
  category?: string;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
};

export type StoreSettings = {
  storeName: string;
};

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag("store-settings");
  return await fetchQuery(api.settings.getStoreSettings, {});
}

function formatProduct(item: Doc<"products">): Product {
  const slug = item.slug || "";

  return {
    id: item._id,
    slug,
    title: item.title,
    price: item.price || "0.00",
    availableForSale: item.availableForSale ?? true,
    categorySlug: item.categorySlug,
    images: item.images.length > 0 ? item.images : [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"
    ],
    options: item.options,
    variants: item.variants?.map((variant) => ({
      ...variant,
      price: { amount: variant.price, currencyCode: "TRY" },
    })),
    seo: item.seo,
    updatedAt: item.updatedAt || new Date(item._creationTime).toISOString(),
  };
}

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  const items = await fetchQuery(api.products.list, { limit: 100, ...(filters.category ? { categorySlug: filters.category } : {}) });
  const mapped = items.map(formatProduct);

  const query = filters.query?.trim().toLowerCase();
  const result = mapped.filter(
    (product) => !query || product.title.toLowerCase().includes(query)
  );

  if (filters.sortKey === "PRICE") {
    result.sort((a, b) => Number(a.price) - Number(b.price));
  }

  return filters.reverse ? result.reverse() : result;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheTag("products");
  const item = await fetchQuery(api.products.getBySlug, { slug });
  if (!item) return undefined;
  return formatProduct(item);
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((product) => product.id !== productId).slice(0, 5);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("categories");
  const items = await fetchQuery(api.categories.list, {});
  const dynamicCategories: Category[] = (items || []).map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    path: c.path,
    seo: c.seo,
    updatedAt: c.updatedAt,
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
    path: item.path,
    seo: item.seo,
    updatedAt: item.updatedAt,
  };
}

export async function getCategoryProducts({
  category,
  ...filters
}: ProductFilters & { category: string }): Promise<Product[]> {
  return getProducts({ ...filters, category });
}

function formatPage(item: Doc<"pages">): Page {
  return {
    id: item._id,
    title: item.title,
    slug: item.slug,
    body: item.body,
    bodySummary: item.bodySummary,
    seo: item.seo,
    createdAt: new Date(item._creationTime).toISOString(),
    updatedAt: item.updatedAt,
  };
}

export async function getPages(): Promise<Page[]> {
  "use cache";
  cacheTag("cms-pages");
  const items = await fetchQuery(api.pages.list, {});
  return items.map(formatPage);
}

export async function getPage(slug: string): Promise<Page | undefined> {
  "use cache";
  cacheTag("cms-pages", `cms-page:${slug}`);
  const item = await fetchQuery(api.pages.getBySlug, { slug });
  if (!item) return undefined;
  return formatPage(item);
}

export async function getMenu(): Promise<Menu[]> {
  "use cache";
  const categories = await getCategories();
  return categories.map((c) => ({
    title: c.title,
    path: c.path,
  }));
}
