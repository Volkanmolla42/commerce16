import type { Product } from "./types";

const SYNONYM_GROUPS = [
  ["fincan", "kupa", "mug", "cup"],
  ["kahve", "coffee"],
  ["ayakkabi", "shoe", "shoes", "footwear", "sneaker"],
  ["giyim", "clothing", "apparel"],
  ["canta", "bag", "handbag"],
  ["tisort", "tshirt", "tee"],
  ["pantolon", "trousers", "pants"],
  ["ceket", "jacket", "coat"],
  ["kapuson", "kapusonlu", "hoodie", "hoodies", "sweatshirt", "sweatshirts"],
  ["elbise", "dress"],
  ["etek", "skirt"],
  ["bot", "boot", "boots"],
  ["aksesuar", "accessory", "accessories"],
  ["seramik", "ceramic"],
];

const SUFFIXES = [
  "lar", "ler", "lari", "leri", "inin", "unun", "nin", "nun", "sinin", "sunun",
  "dan", "den", "tan", "ten", "ina", "ine", "una", "une", "si", "su", "yi", "yu",
  "in", "un", "de", "da",
];

export function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bt[-\s]+shirt\b/g, "tshirt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stemToken(token: string) {
  for (const suffix of SUFFIXES) {
    if (token.length - suffix.length >= 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  if (token.length >= 7 && /[iu]$/.test(token)) return token.slice(0, -1);
  return token;
}

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  const stems = group.map((word) => stemToken(normalizeSearchText(word)));
  for (const stem of stems) SYNONYMS.set(stem, group);
}

function getSynonyms(token: string) {
  const stem = stemToken(token);
  return SYNONYMS.get(stem) ?? [stem];
}

function editDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row++) distance[row][0] = row;
  for (let column = 0; column < columns; column++) distance[0][column] = column;

  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 && column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        distance[row][column] = Math.min(distance[row][column], distance[row - 2][column - 2] + 1);
      }
    }
  }

  return distance[left.length][right.length];
}

function tokenMatchScore(queryToken: string, candidateTokens: string[], cache: Map<string, number>) {
  const queryStem = stemToken(queryToken);
  const synonyms = getSynonyms(queryStem).map(stemToken);
  let bestScore = 0;

  for (const candidateToken of candidateTokens) {
    const candidateStem = stemToken(candidateToken);
    const cacheKey = `${queryStem}:${candidateStem}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      if (cached === 1) return 1;
      bestScore = Math.max(bestScore, cached);
      continue;
    }
    // Cache scores per token pair, so a common catalog word is compared only once per search.
    let score = 0;
    if (queryStem === candidateStem) { cache.set(cacheKey, 1); return 1; }
    if (synonyms.includes(candidateStem) || getSynonyms(candidateStem).some((word) => synonyms.includes(stemToken(word)))) {
      cache.set(cacheKey, 0.88); bestScore = Math.max(bestScore, 0.88);
      continue;
    }
    if (queryStem.length >= 3 && (candidateStem.startsWith(queryStem) || queryStem.startsWith(candidateStem))) {
      cache.set(cacheKey, 0.82); bestScore = Math.max(bestScore, 0.82);
      continue;
    }

    if (queryStem.length >= 3 && candidateStem.length >= queryStem.length) {
      const prefix = candidateStem.slice(0, queryStem.length);
      if (editDistance(queryStem, prefix) === 1) {
        cache.set(cacheKey, 0.76); bestScore = Math.max(bestScore, 0.76);
        continue;
      }
    }

    const shortestLength = Math.min(queryStem.length, candidateStem.length);
    const allowedDistance = shortestLength >= 8 ? 2 : shortestLength >= 5 ? 1 : 0;
    if (allowedDistance > 0 && Math.abs(queryStem.length - candidateStem.length) <= allowedDistance) {
      const edits = editDistance(queryStem, candidateStem);
      if (edits <= allowedDistance) score = 0.72 - edits * 0.04;
    }
    cache.set(cacheKey, score);
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function createSearchScorer(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = [...new Set(normalizedQuery.split(" ").map(stemToken).filter(Boolean))];
  const cache = new Map<string, number>();
  return (rawFields: Array<string | undefined>) => {
    const fields = rawFields.filter((field): field is string => Boolean(field)).map(normalizeSearchText).filter(Boolean);
    const tokens = [...new Set(fields.flatMap((field) => field.split(" ").map(stemToken)))];
    if (normalizedQuery.length < 2 || queryTokens.length === 0 || !fields.length) return 0;
    const phraseMatch = fields.some((field) => field.includes(normalizedQuery));
    const tokenScores = queryTokens.map((token) => tokenMatchScore(token, tokens, cache));
    const coverage = tokenScores.filter((score) => score > 0).length / queryTokens.length;
    if (coverage < (queryTokens.length === 1 ? 1 : 0.67)) return 0;
    return tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length + coverage + (phraseMatch ? 1.5 : 0);
  };
}

export function getSearchScore(query: string, fields: Array<string | undefined>) {
  return createSearchScorer(query)(fields);
}

export function rankSearchItems<T>(items: T[], query: string, getFields: (item: T) => Array<string | undefined>) {
  const score = createSearchScorer(query);
  return items.map((item, index) => ({ item, index, score: score(getFields(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

export function getProductSearchFields(product: Pick<Product, "title" | "slug" | "categorySlug"> & {
  sku?: string;
  variants?: Array<{ sku?: string; barcode?: string; title: string; selectedOptions: Array<{ name: string; value: string }> }>;
  options?: Array<{ name: string; values: string[] }>;
}): Array<string | undefined> {
  return [
    product.title,
    product.sku,
    product.slug,
    product.categorySlug,
    ...(product.variants ?? []).flatMap((variant) => [
      variant.title,
      variant.sku,
      variant.barcode,
      ...variant.selectedOptions.map((option) => `${option.name} ${option.value}`),
    ]),
    ...(product.options ?? []).flatMap((option) => [option.name, ...option.values]),
  ];
}

/** Index normalized catalog text and the existing synonym vocabulary once on write. */
export function getProductSearchText(product: Parameters<typeof getProductSearchFields>[0]) {
  const text = normalizeSearchText(getProductSearchFields(product).filter(Boolean).join(" "));
  const synonyms = text.split(" ").flatMap((token) => SYNONYMS.get(stemToken(token)) ?? []);
  return [...new Set([text, ...synonyms])].join(" ");
}

export function catalogSearchQuery(query: string) {
  return normalizeSearchText(query.trim().slice(0, 200)).split(" ").filter(Boolean)
    .filter((token) => token.length <= 32).slice(0, 16).join(" ");
}

/** Match normalized index text when a numeric/date index supplies the order.
 * Like Convex typeahead, only the final query term permits a prefix match.
 */
export function createCatalogSearchMatcher(search: string) {
  const terms = search.split(" ").filter(Boolean);
  return (text: string) => {
    const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 0 && word.length <= 32);
    const exactWords = new Set(words);
    return terms.some((term, index) => index === terms.length - 1
      ? words.some((word) => word.startsWith(term))
      : exactWords.has(term));
  };
}
