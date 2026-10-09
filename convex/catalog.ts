import { paginationOptsValidator, paginationResultValidator, type OrderedQuery } from "convex/server";
import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { assertAdminApiSecret } from "./adminAuth";
import { getProductPriceRange } from "../lib/catalog/variants";
import { catalogSearchQuery, createCatalogSearchMatcher } from "../lib/catalog/smart-search";
import { matchesCatalogFilters, matchesCategoryAttributeFilters } from "../lib/catalog/facets";
import type { Product } from "../lib/catalog/types";

const filtersValidator = v.object({ minPrice: v.string(), maxPrice: v.string(), stock: v.union(v.literal(""), v.literal("in"), v.literal("out")) });
const attributeFiltersValidator = v.record(v.string(), v.object({ values: v.array(v.string()), min: v.string(), max: v.string() }));
const availabilityValidator = v.union(v.literal("all"), v.literal("active"), v.literal("inactive"));
const stockValidator = v.union(v.literal("all"), v.literal("in-stock"), v.literal("out-of-stock"), v.literal("untracked"));
const cardValidator = v.object({
  id: v.id("products"), title: v.string(), slug: v.string(), price: v.string(),
  priceRange: v.object({ min: v.string(), max: v.string() }), images: v.array(v.string()),
  availableForSale: v.boolean(), stockQuantity: v.union(v.number(), v.null()),
  updatedAt: v.string(), categorySlug: v.optional(v.string()),
});

function inventory(product: Doc<"products">) {
  const variants = product.variants ?? [];
  const quantity = variants.length
    ? variants.some((variant) => variant.stockQuantity == null) ? null : variants.reduce((sum, variant) => sum + (variant.stockQuantity ?? 0), 0)
    : product.stockQuantity ?? null;
  const inStock = product.availableForSale && (variants.length
    ? variants.some((variant) => variant.availableForSale && (variant.stockQuantity ?? product.stockQuantity ?? 1) > 0)
    : product.stockQuantity == null || product.stockQuantity > 0);
  return { quantity, inStock };
}

async function card(ctx: QueryCtx, product: Doc<"products">, admin: boolean) {
  const image = product.images[0] || (product.storageImages?.[0] ? await ctx.storage.getUrl(product.storageImages[0].storageId) : null);
  const stock = inventory(product);
  return { id: product._id, title: product.title, slug: product.slug, price: product.price,
    priceRange: getProductPriceRange(product), images: image ? [image] : [],
    availableForSale: admin ? product.availableForSale : stock.inStock,
    stockQuantity: stock.quantity, updatedAt: product.updatedAt, categorySlug: product.categorySlug };
}

export const page = query({
  args: {
    paginationOpts: paginationOptsValidator, query: v.string(), categorySlug: v.optional(v.string()),
    sort: v.string(), filters: filtersValidator, attributes: attributeFiltersValidator,
    adminSecret: v.optional(v.string()), availability: v.optional(availabilityValidator), stock: v.optional(stockValidator),
  },
  returns: paginationResultValidator(cardValidator),
  handler: async (ctx, args) => {
    const admin = args.adminSecret !== undefined;
    if (admin) assertAdminApiSecret(args.adminSecret!);
    if (args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 24) throw new Error("Sayfa boyutu 1-24 arasında olmalı.");
    const available = admin ? args.availability === "active" ? true : args.availability === "inactive" ? false : undefined : true;
    const category = args.categorySlug;
    const search = catalogSearchQuery(args.query);
    if (args.query.trim() && !search) return { page: [], isDone: true, continueCursor: "" };
    const orderedSearch = Boolean(search) && ["price-asc", "price-desc", "latest-desc"].includes(args.sort);
    const matchesSearch = orderedSearch ? createCatalogSearchMatcher(search) : null;
    let listing: OrderedQuery<DataModel["products"]>;
    if (search && !orderedSearch) {
      listing = ctx.db.query("products").withSearchIndex("search_catalog", (q) => {
        let range = q.search("searchText", search);
        if (available !== undefined) range = range.eq("availableForSale", available);
        if (category !== undefined) range = range.eq("categorySlug", category);
        return range;
      });
    } else if (args.sort === "price-asc" || args.sort === "price-desc") {
      const min = args.filters.minPrice === "" ? 0 : Number(args.filters.minPrice);
      const max = args.filters.maxPrice === "" ? Number.MAX_VALUE : Number(args.filters.maxPrice);
      if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error("Fiyat aralığı geçersiz.");
      const base = ctx.db.query("products");
      const priced = available !== undefined && category !== undefined
        ? base.withIndex("by_available_and_category_and_priceValue", (q) => q.eq("availableForSale", available).eq("categorySlug", category).gte("priceValue", min).lte("priceValue", max))
        : available !== undefined
          ? base.withIndex("by_available_and_priceValue", (q) => q.eq("availableForSale", available).gte("priceValue", min).lte("priceValue", max))
          : category !== undefined
            ? base.withIndex("by_category_and_priceValue", (q) => q.eq("categorySlug", category).gte("priceValue", min).lte("priceValue", max))
            : base.withIndex("by_priceValue", (q) => q.gte("priceValue", min).lte("priceValue", max));
      listing = priced.order(args.sort === "price-desc" ? "desc" : "asc");
    } else {
      const base = ctx.db.query("products");
      const indexed = available !== undefined && category !== undefined
        ? base.withIndex("by_available_and_category", (q) => q.eq("availableForSale", available).eq("categorySlug", category))
        : available !== undefined ? base.withIndex("by_available", (q) => q.eq("availableForSale", available))
          : category !== undefined ? base.withIndex("by_category", (q) => q.eq("categorySlug", category)) : base;
      listing = indexed.order(admin || args.sort === "latest-desc" ? "desc" : "asc");
    }
    const definitions = category === undefined ? [] : (await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", category)).unique())?.attributes ?? [];
    const result = await listing.paginate(args.paginationOpts);
    // Explicit search sorting uses the ordered index and checks text within the
    // bounded page, retaining its cursor even when no row matches.
    const matches = result.page.filter((product) => {
      if (matchesSearch && !matchesSearch(product.searchText)) return false;
      const stock = inventory(product);
      if (admin && args.stock && args.stock !== "all") {
        if (args.stock === "untracked" ? stock.quantity !== null : args.stock === "out-of-stock" ? stock.quantity !== 0 : stock.quantity == null || stock.quantity <= 0) return false;
      }
      const target: Product = { id: product._id, title: product.title, slug: product.slug, price: getProductPriceRange(product).min,
        images: [], availableForSale: stock.inStock, stockQuantity: stock.quantity,
        attributes: product.attributes, updatedAt: product.updatedAt };
      return matchesCatalogFilters(target, args.filters) && matchesCategoryAttributeFilters(target, definitions, args.attributes);
    });
    return { ...result, page: await Promise.all(matches.map((product) => card(ctx, product, admin))) };
  },
});

export const stats = query({
  args: { adminSecret: v.string() }, returns: v.object({ total: v.number(), active: v.number() }),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    const stats = await ctx.db.query("catalogStats").withIndex("by_key", (q) => q.eq("key", "products")).unique();
    return { total: stats?.total ?? 0, active: stats?.active ?? 0 };
  },
});

export const facets = query({
  args: { categorySlug: v.string() }, returns: v.record(v.string(), v.array(v.string())),
  handler: async (ctx, { categorySlug }) => {
    const category = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", categorySlug)).unique();
    const entries = await Promise.all((category?.attributes ?? []).map(async (definition) => {
      if (definition.type === "text") return [definition.key, []] as const;
      if (definition.type === "number") {
        const values = () => ctx.db.query("catalogFacetValues").withIndex("by_category_and_key_and_numericValue", (q) => q.eq("categorySlug", categorySlug).eq("key", definition.key).gt("numericValue", undefined));
        const [min, max] = await Promise.all([values().order("asc").first(), values().order("desc").first()]);
        return [definition.key, min && max ? [min.value, max.value] : []] as const;
      }
      const values = await ctx.db.query("catalogFacetValues").withIndex("by_category_and_key_and_value", (q) => q.eq("categorySlug", categorySlug).eq("key", definition.key)).take(100);
      return [definition.key, values.map((entry) => entry.value)] as const;
    }));
    return Object.fromEntries(entries);
  },
});
