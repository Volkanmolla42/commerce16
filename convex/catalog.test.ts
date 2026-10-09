/// <reference types="vite/client" />
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import schema from "./schema";
import { api } from "./_generated/api";
import { insertCatalogProduct, patchCatalogProduct, deleteCatalogProduct } from "./catalogModel";
import { createCatalogSearchMatcher } from "../lib/catalog/smart-search";

const modules = import.meta.glob("./**/*.ts");
const secret = "catalog-test-secret";
const args = {
  paginationOpts: { numItems: 24, cursor: null as string | null, maximumRowsRead: 128 },
  query: "", sort: "price-asc", filters: { minPrice: "", maxPrice: "" }, attributes: {},
};
const product = (index: number, availableForSale = true, price = String(index + 1)) => ({
  title: `Test ürün ${index}`, slug: `test-${index}`, images: [], options: [],
  variants: [{ id: `v-${index}`, title: "Ürünün kendisi", selectedOptions: [], price, stockQuantity: 0, availableForSale }],
  availableForSale, updatedAt: "2026-01-01T00:00:00.000Z",
});

beforeEach(() => vi.stubEnv("ADMIN_API_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());

describe("indexed catalog pages", () => {
  it("reaches every product without duplicates using bounded cursor pages", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let index = 0; index < 61; index++) await insertCatalogProduct(ctx, product(index));
      await insertCatalogProduct(ctx, product(62, false));
    });
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let index = 0; index < 3; index++) {
      const page: FunctionReturnType<typeof api.catalog.page> = await t.query(api.catalog.page, { ...args, paginationOpts: { ...args.paginationOpts, cursor } });
      expect(page.page.length).toBeLessThanOrEqual(24);
      ids.push(...page.page.map((item) => item.id));
      cursor = page.continueCursor;
      expect(page.isDone).toBe(index === 2);
    }
    expect(new Set(ids).size).toBe(61);
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 62, active: 61 });
  });

  it("sorts numeric prices globally and narrows category and price ranges", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const price of ["100", "9", "20", "11"]) await insertCatalogProduct(ctx, { ...product(Number(price), true, price), categorySlug: "shoes" });
      await insertCatalogProduct(ctx, { ...product(12), categorySlug: "other" });
    });
    const result = await t.query(api.catalog.page, { ...args, categorySlug: "shoes", sort: "price-desc", filters: { ...args.filters, minPrice: "10", maxPrice: "30" } });
    expect(result.page.map((item) => item.price)).toEqual(["20", "11"]);
  });

  it("sorts and filters by the displayed variant minimum and updates it on edit", async () => {
    const t = convexTest(schema, modules);
    const variants = [
      { id: "a", title: "A", selectedOptions: [{ name: "Size", value: "A" }], price: "100", stockQuantity: 0, availableForSale: true },
      { id: "b", title: "B", selectedOptions: [{ name: "Size", value: "B" }], price: "10", stockQuantity: 0, availableForSale: true },
    ];
    const id = await t.run(async (ctx) => {
      const id = await insertCatalogProduct(ctx, { ...product(0), options: [{ id: "size", name: "Size", values: ["A", "B"] }], variants });
      await insertCatalogProduct(ctx, product(1, true, "50"));
      return id;
    });
    expect((await t.query(api.catalog.page, args)).page.map((item) => item.priceRange.min)).toEqual(["10", "50"]);
    expect((await t.query(api.catalog.page, { ...args, sort: "price-desc" })).page.map((item) => item.priceRange.min)).toEqual(["50", "10"]);
    for (const sort of ["", "price-asc"]) {
      const page = await t.query(api.catalog.page, { ...args, sort, filters: { ...args.filters, minPrice: "5", maxPrice: "20" } });
      expect(page.page.map((item) => item.id)).toEqual([id]);
    }
    await t.run(async (ctx) => {
      await patchCatalogProduct(ctx, (await ctx.db.get(id))!, { variants: variants.map((variant) => ({ ...variant, price: "75" })) });
    });
    expect((await t.query(api.catalog.page, args)).page.map((item) => item.priceRange.min)).toEqual(["50", "75"]);
  });

  it("keeps a continuation even when an attribute filter removes a whole page", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("categories", { slug: "shoes", title: "Shoes", description: "", updatedAt: "2026-01-01", attributes: [{ key: "color", label: "Color", type: "select", required: false, options: ["Red", "Blue"] }] });
      for (let index = 0; index < 25; index++) await insertCatalogProduct(ctx, { ...product(index), categorySlug: "shoes", attributes: [{ key: "color", value: index === 24 ? "Red" : "Blue" }] });
    });
    const query = { ...args, categorySlug: "shoes", attributes: { color: { values: ["Red"], min: "", max: "" } } };
    const first = await t.query(api.catalog.page, query);
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await t.query(api.catalog.page, { ...query, paginationOpts: { ...args.paginationOpts, cursor: first.continueCursor } });
    expect(second.page.map((item) => item.slug)).toEqual(["test-24"]);
  });

  it("searches normalized SKU and synonyms through the full text index", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await insertCatalogProduct(ctx, { ...product(0), title: "Deri Ayakkabı", options: [{ id: "numara", name: "Numara", values: ["40"] }], variants: [{ id: "v1", title: "40", selectedOptions: [{ name: "Numara", value: "40" }], price: "1", stockQuantity: 0, sku: "SNK-40", availableForSale: true }] });
      await insertCatalogProduct(ctx, product(1, false));
    });
    for (const query of ["ayakkabi", "shoe", "SNK-40"]) {
      const result = await t.query(api.catalog.page, { ...args, query });
      expect(result.page.map((item) => item.slug)).toEqual(["test-0"]);
    }
    expect((await t.query(api.catalog.page, { ...args, query: "!!!" })).page).toEqual([]);
  });

  it("protects inactive products and administrator stats", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { await insertCatalogProduct(ctx, product(0, false)); });
    expect((await t.query(api.catalog.page, { ...args, availability: "inactive" })).page).toEqual([]);
    expect((await t.query(api.catalog.page, { ...args, adminSecret: secret, availability: "inactive" })).page).toHaveLength(1);
    await expect(t.query(api.catalog.page, { ...args, adminSecret: "invalid" })).rejects.toThrow("doğrulanamadı");
    await expect(t.query(api.catalog.stats, { adminSecret: "invalid" })).rejects.toThrow("doğrulanamadı");
    await expect(t.query(api.catalog.page, { ...args, paginationOpts: { ...args.paginationOpts, numItems: 25 } })).rejects.toThrow("1-24");
  });

  it("honors search price/date ordering across cursor pages without losing matches", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let index = 0; index < 35; index++) {
        await insertCatalogProduct(ctx, { ...product(index, true, String(35 - index)), title: "Deri Ayakkabı" });
      }
      await insertCatalogProduct(ctx, { ...product(40, true, "0"), title: "Kupa" });
      await insertCatalogProduct(ctx, { ...product(41, false, "0"), title: "Deri Ayakkabı" });
      await insertCatalogProduct(ctx, { ...product(42, true, "0"), title: "Deri Ayakkabı", categorySlug: "other" });
    });
    for (const sort of ["price-asc", "price-desc", "latest-desc"]) {
      const items: FunctionReturnType<typeof api.catalog.page>["page"] = [];
      let cursor: string | null = null;
      let isDone = false;
      for (let pageNumber = 0; !isDone && pageNumber < 5; pageNumber++) {
        const page: FunctionReturnType<typeof api.catalog.page> = await t.query(api.catalog.page, {
          ...args, query: "shoe", sort, categorySlug: "other",
          paginationOpts: { ...args.paginationOpts, numItems: 8, cursor },
        });
        items.push(...page.page);
        cursor = page.continueCursor;
        isDone = page.isDone;
      }
      expect(isDone).toBe(true);
      expect(items.map((item) => item.slug)).toEqual(["test-42"]);

      const matches: typeof items = [];
      cursor = null;
      isDone = false;
      for (let pageNumber = 0; !isDone && pageNumber < 8; pageNumber++) {
        const page: FunctionReturnType<typeof api.catalog.page> = await t.query(api.catalog.page, {
          ...args, query: "ayakkab", sort,
          paginationOpts: { ...args.paginationOpts, numItems: 8, cursor },
        });
        matches.push(...page.page);
        cursor = page.continueCursor;
        isDone = page.isDone;
      }
      expect(isDone).toBe(true);
      expect(new Set(matches.map((item) => item.id)).size).toBe(36);
      const prices = matches.map((item) => Number(item.priceRange.min));
      expect(prices).toEqual(sort === "price-desc"
        ? Array.from({ length: 36 }, (_, index) => 35 - index)
        : Array.from({ length: 36 }, (_, index) => index));
    }
  });

  it("preserves the cursor for an empty sorted search page and applies price bounds", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let index = 0; index < 24; index++) await insertCatalogProduct(ctx, { ...product(index), title: "Kupa" });
      await insertCatalogProduct(ctx, { ...product(24), title: "Ayakkabı" });
    });
    const first = await t.query(api.catalog.page, { ...args, query: "shoe" });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await t.query(api.catalog.page, { ...args, query: "shoe", paginationOpts: { ...args.paginationOpts, cursor: first.continueCursor } });
    expect(second.page.map((item) => item.slug)).toEqual(["test-24"]);
    const limited = await t.query(api.catalog.page, { ...args, query: "shoe", filters: { ...args.filters, maxPrice: "24" } });
    expect(limited.page).toEqual([]);
    expect(limited.isDone).toBe(true);
  });

  it("matches complete terms and only prefixes the final search term", () => {
    expect(createCatalogSearchMatcher("der ayakkab")("deri kupa")).toBe(false);
    expect(createCatalogSearchMatcher("der ayakkab")("ayakkabi")).toBe(true);
    expect(createCatalogSearchMatcher("deri ayakkab")("deri kupa")).toBe(true);
    expect(createCatalogSearchMatcher("kupa")("superkupa")).toBe(false);
  });
});

describe("atomic catalog read models", () => {
  it("keeps the read model consistent through the actual admin product mutations", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.products.create, {
      title: "Test ürün", slug: "test-0", images: [], options: [], availableForSale: true, adminSecret: secret,
      variants: [{ id: "v1", title: "Ürünün kendisi", selectedOptions: [], price: "1", stockQuantity: 0, sku: "TEST-1", availableForSale: true }],
    });
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 1, active: 1 });
    await t.mutation(api.products.update, { id, adminSecret: secret, availableForSale: false, title: "Yeni kupa", variants: [{ id: "v1", title: "Ürünün kendisi", selectedOptions: [], price: "12", stockQuantity: 0, sku: "TEST-1", availableForSale: true }] });
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 1, active: 0 });
    expect((await t.query(api.catalog.page, { ...args, query: "kupa", adminSecret: secret })).page[0]?.price).toBe("12");
    await t.mutation(api.products.remove, { id, adminSecret: secret });
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 0, active: 0 });
  });

  it("updates counts, search text and facets on edit, unpublish and delete", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      await ctx.db.insert("categories", { slug: "shoes", title: "Shoes", description: "", updatedAt: "2026-01-01", attributes: [{ key: "size", label: "Size", type: "number", required: false }] });
      return insertCatalogProduct(ctx, { ...product(0), categorySlug: "shoes", attributes: [{ key: "size", value: -2 }] });
    });
    expect(await t.query(api.catalog.facets, { categorySlug: "shoes" })).toEqual({ size: ["-2", "-2"] });
    await t.run(async (ctx) => {
      const previous = (await ctx.db.get(id))!;
      await patchCatalogProduct(ctx, previous, { title: "Yeni kupa", attributes: [{ key: "size", value: 15 }] });
    });
    expect((await t.query(api.catalog.page, { ...args, query: "kupa" })).page).toHaveLength(1);
    expect(await t.query(api.catalog.facets, { categorySlug: "shoes" })).toEqual({ size: ["15", "15"] });
    await t.run(async (ctx) => { await patchCatalogProduct(ctx, (await ctx.db.get(id))!, { availableForSale: false }); });
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 1, active: 0 });
    expect(await t.query(api.catalog.facets, { categorySlug: "shoes" })).toEqual({ size: [] });
    await t.run(async (ctx) => { await deleteCatalogProduct(ctx, (await ctx.db.get(id))!); });
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 0, active: 0 });
  });

  it("rolls back product and metadata together when a mutation fails", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(async (ctx) => {
      await insertCatalogProduct(ctx, product(0));
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await t.query(api.catalog.stats, { adminSecret: secret })).toEqual({ total: 0, active: 0 });
    expect((await t.query(api.catalog.page, args)).page).toEqual([]);
  });
});
