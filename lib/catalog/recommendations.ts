import type { Product } from "./types";

const RECENT_PRODUCTS_KEY = "commerce_recent_products_v1";
export const RECENT_PRODUCTS_EVENT = "commerce:recent-products";
const MAX_RECENT_PRODUCTS = 20;

function readRecentProducts(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((slug): slug is string => typeof slug === "string").slice(0, MAX_RECENT_PRODUCTS)
      : [];
  } catch {
    return [];
  }
}

export function getRecentProductSlugs(): string[] {
  if (typeof window === "undefined") return [];
  return readRecentProducts();
}

export function recordRecentProduct(slug: string) {
  if (typeof window === "undefined" || !slug) return;
  const recent = [slug, ...readRecentProducts().filter((item) => item !== slug)].slice(0, MAX_RECENT_PRODUCTS);
  try {
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recent));
  } catch {
    // Recommendations still work from the current cart when storage is unavailable.
  }
  window.dispatchEvent(new Event(RECENT_PRODUCTS_EVENT));
}

function similarity(source: Product, candidate: Product) {
  let score = 0;
  if (source.categorySlug && source.categorySlug === candidate.categorySlug) score += 8;

  const sourcePrice = Number(source.price);
  const candidatePrice = Number(candidate.price);
  if (sourcePrice > 0 && candidatePrice > 0) {
    const ratio = Math.max(sourcePrice, candidatePrice) / Math.min(sourcePrice, candidatePrice);
    if (ratio <= 1.25) score += 2;
    else if (ratio <= 1.75) score += 1;
  }

  if (source.options?.length && candidate.options?.length) {
    const normalize = (value: string) => value.trim().toLocaleLowerCase("tr-TR");
    const sourceValues = new Set(source.options.flatMap((option) => option.values.map(normalize)));
    if (candidate.options.some((option) => option.values.some((value) => sourceValues.has(normalize(value))))) score += 1;
  }
  return score;
}

export function rankProductRecommendations(
  catalog: Product[],
  sources: Array<{ product: Product; weight?: number }>,
  excludedSlugs: string[] = sources.map(({ product }) => product.slug),
  limit = 8,
): Product[] {
  const excluded = new Set(excludedSlugs);
  const eligible = catalog.filter((product) => product.availableForSale && !excluded.has(product.slug));
  const scores = eligible.map((product) => ({
    product,
    score: sources.reduce((total, source) => total + similarity(source.product, product) * (source.weight ?? 1), 0),
  }));

  scores.sort((a, b) =>
    b.score - a.score ||
    a.product.title.localeCompare(b.product.title, "tr"),
  );

  return scores.slice(0, limit).map(({ product }) => product);
}

export function getSimilarProducts(product: Product, catalog: Product[], limit = 5) {
  return rankProductRecommendations(catalog, [{ product }], [product.slug], limit);
}

export function rankUpsellRecommendations(
  catalog: Product[],
  source: Product,
  excludedSlugs: string[] = [source.slug],
  limit = 8,
) {
  const sourcePrice = Number(source.price);
  if (!Number.isFinite(sourcePrice) || sourcePrice <= 0) return [];
  return rankProductRecommendations(catalog, [{ product: source }], excludedSlugs, catalog.length)
    .filter((candidate) => Number(candidate.price) > sourcePrice)
    .slice(0, limit);
}
