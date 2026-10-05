import type { Category, Menu, Page, Product } from "./types";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

type ProductFilters = {
  query?: string;
  sortKey?: string;
  reverse?: boolean;
};

function formatProduct(item: any): Product {
  const slug = item.slug || "";
  const images = Array.isArray(item.images)
    ? item.images.map((img: any) => (typeof img === "string" ? img : img?.url || ""))
    : [];

  return {
    id: item._id,
    slug,
    title: item.title,
    price: item.price || "0.00",
    availableForSale: item.availableForSale ?? true,
    categorySlug: item.categorySlug,
    images: images.length > 0 ? images : [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"
    ],
    options: item.options,
    variants: item.variants,
    seo: item.seo,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

// 1. Ürünleri Convex Veritabanından Getir
export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  "use cache";
  const items = await fetchQuery(api.products.list, { limit: 100 });
  const mapped: Product[] = (items || []).map(formatProduct);

  const query = filters.query?.trim().toLowerCase();
  let result = mapped.filter(
    (product) => !query || product.title.toLowerCase().includes(query)
  );

  if (filters.sortKey === "PRICE") {
    result.sort((a, b) => Number(a.price) - Number(b.price));
  }

  return filters.reverse ? result.reverse() : result;
}

// 2. Tekil Ürünü Convex Veritabanından Getir
export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  const item = await fetchQuery(api.products.getBySlug, { slug });
  if (!item) return undefined;
  return formatProduct(item);
}

// 3. Önerilen Ürünleri Convex'ten Getir
export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((product) => product.id !== productId).slice(0, 5);
}

// 4. Kategorileri Convex Veritabanından Getir
export async function getCategories(): Promise<Category[]> {
  "use cache";
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
      updatedAt: new Date().toISOString(),
    },
    ...dynamicCategories,
  ];
}

// 5. Tekil Kategori Getir
export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
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

// 6. Kategoriye Ait Ürünleri Getir
export async function getCategoryProducts({
  category,
  ...filters
}: ProductFilters & { category: string }): Promise<Product[]> {
  "use cache";
  const all = await getProducts(filters);
  if (!category) return all;
  return all.filter((product) => product.categorySlug === category);
}

// 7. Sayfaları Convex Veritabanından Getir
export async function getPages(): Promise<Page[]> {
  "use cache";
  const items = await fetchQuery(api.pages.list, {});
  return (items || []).map((p) => ({
    id: p._id,
    title: p.title,
    slug: p.slug,
    body: p.body,
    bodySummary: p.bodySummary,
    seo: p.seo,
    createdAt: new Date(p._creationTime).toISOString(),
    updatedAt: p.updatedAt,
  }));
}

// 8. Tekil Sayfa Getir
export async function getPage(slug: string): Promise<Page | undefined> {
  "use cache";
  const item = await fetchQuery(api.pages.getBySlug, { slug });
  if (!item) return undefined;
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

// 9. Dinamik Menü
export async function getMenu(): Promise<Menu[]> {
  "use cache";
  const categories = await getCategories();
  return categories.map((c) => ({
    title: c.title,
    path: c.path,
  }));
}
