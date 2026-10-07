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

function getSynonyms(token: string) {
  const stem = stemToken(token);
  return SYNONYM_GROUPS.find((group) => group.some((word) => stemToken(normalizeSearchText(word)) === stem)) ?? [stem];
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

function tokenMatchScore(queryToken: string, candidateTokens: string[]) {
  const queryStem = stemToken(queryToken);
  const synonyms = getSynonyms(queryStem).map(stemToken);
  let bestScore = 0;

  for (const candidateToken of candidateTokens) {
    const candidateStem = stemToken(candidateToken);
    if (queryStem === candidateStem) return 1;
    if (synonyms.includes(candidateStem) || getSynonyms(candidateStem).some((word) => synonyms.includes(stemToken(word)))) {
      bestScore = Math.max(bestScore, 0.88);
      continue;
    }
    if (queryStem.length >= 3 && (candidateStem.startsWith(queryStem) || queryStem.startsWith(candidateStem))) {
      bestScore = Math.max(bestScore, 0.82);
      continue;
    }

    if (queryStem.length >= 3 && candidateStem.length >= queryStem.length) {
      const prefix = candidateStem.slice(0, queryStem.length);
      if (editDistance(queryStem, prefix) === 1) {
        bestScore = Math.max(bestScore, 0.76);
        continue;
      }
    }

    const shortestLength = Math.min(queryStem.length, candidateStem.length);
    const allowedDistance = shortestLength >= 8 ? 2 : shortestLength >= 5 ? 1 : 0;
    if (allowedDistance > 0) {
      const edits = editDistance(queryStem, candidateStem);
      if (edits <= allowedDistance) bestScore = Math.max(bestScore, 0.72 - edits * 0.04);
    }
  }

  return bestScore;
}

export function getSearchScore(query: string, fields: Array<string | undefined>) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return 0;

  const normalizedFields = fields
    .filter((field): field is string => Boolean(field))
    .map(normalizeSearchText)
    .filter(Boolean);
  if (normalizedFields.length === 0) return 0;

  const phraseMatch = normalizedFields.some((field) => field.includes(normalizedQuery));
  const queryTokens = [...new Set(normalizedQuery.split(" ").map(stemToken).filter(Boolean))];
  const candidateTokens = [...new Set(normalizedFields.flatMap((field) => field.split(" ").map(stemToken)))];
  const tokenScores = queryTokens.map((token) => tokenMatchScore(token, candidateTokens));
  const coverage = tokenScores.filter((score) => score > 0).length / queryTokens.length;
  if (coverage < (queryTokens.length === 1 ? 1 : 0.67)) return 0;

  const averageScore = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  return averageScore + coverage + (phraseMatch ? 1.5 : 0);
}

export function rankSearchItems<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | undefined>,
) {
  return items
    .map((item, index) => ({ item, index, score: getSearchScore(query, getFields(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

export function getProductSearchFields(product: Pick<Product, "title" | "slug" | "categorySlug"> & {
  variants?: Array<{ title: string; selectedOptions: Array<{ name: string; value: string }> }>;
  options?: Array<{ name: string; values: string[] }>;
}): Array<string | undefined> {
  return [
    product.title,
    product.slug,
    product.categorySlug,
    ...(product.variants ?? []).flatMap((variant) => [
      variant.title,
      ...variant.selectedOptions.map((option) => `${option.name} ${option.value}`),
    ]),
    ...(product.options ?? []).flatMap((option) => [option.name, ...option.values]),
  ];
}
