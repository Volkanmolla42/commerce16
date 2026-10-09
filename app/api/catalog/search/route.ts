import { NextRequest, NextResponse } from "next/server";
import { getCatalogPage } from "@/lib/catalog/pages";
import { getCategories } from "@/lib/catalog";
import { rankSearchItems } from "@/lib/catalog/smart-search";
import { getProductPriceRange } from "@/lib/catalog/variants";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (query.length < 2) return NextResponse.json([]);
  const [catalog, categories] = await Promise.all([getCatalogPage({ q: query }), getCategories()]);
  const options = [
    ...rankSearchItems(categories.filter((category) => category.slug), query,
      (category) => [category.title, category.slug, category.description]).slice(0, 3).map((category) => ({
      key: `category-${category.slug}`, kind: "category", title: category.title, href: category.path,
    })),
    ...catalog.products.slice(0, 5).map((product) => {
      const range = getProductPriceRange(product);
      return { key: `product-${product.slug}`, kind: "product", title: product.title,
        href: `/product/${encodeURIComponent(product.slug)}`, image: product.images[0]?.url ?? null,
        price: range.min, maxPrice: range.max };
    }),
  ];
  return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
}
