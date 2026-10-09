/// <reference types="vite/client" />
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { parseAttributeTemplate, parseCategoryAttributes } from "../lib/catalog/attributes";

const modules = import.meta.glob("./**/*.ts");
const secret = "preset-test-secret";
const args = { adminSecret: secret, search: "", paginationOpts: { numItems: 24, cursor: null as string | null } };

beforeEach(() => vi.stubEnv("ADMIN_API_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());

describe("category attribute library pagination", () => {
  it("reaches records beyond 100 and finds a newly saved record without loading previous pages", async () => {
    const t = convexTest(schema, modules);
    const ids = new Set<string>();
    for (let index = 0; index < 121; index++) {
      ids.add(await t.mutation(api.categoryAttributePresets.create, {
        adminSecret: secret, label: `Özellik ${String(index).padStart(3, "0")}`, type: "text", required: false,
      }));
    }
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let index = 0; index < 6; index++) {
      const result: FunctionReturnType<typeof api.categoryAttributePresets.listAdmin> = await t.query(api.categoryAttributePresets.listAdmin, {
        ...args, paginationOpts: { ...args.paginationOpts, cursor },
      });
      expect(result.page.length).toBeLessThanOrEqual(24);
      for (const preset of result.page) {
        expect(seen.has(preset._id)).toBe(false);
        seen.add(preset._id);
      }
      expect(result.isDone).toBe(index === 5);
      cursor = result.continueCursor;
    }
    expect(seen).toEqual(ids);
    const search = await t.query(api.categoryAttributePresets.listAdmin, { ...args, search: "120" });
    expect(search.page.map((preset) => preset.label)).toEqual(["Özellik 120"]);
  });

  it("supports Turkish prefix searches and preserves duplicate validation", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, label: "Ölçü Birimi", type: "text", required: false });
    expect((await t.query(api.categoryAttributePresets.listAdmin, { ...args, search: "ÖLÇ" })).page[0]?._id).toBe(id);
    await expect(t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, label: "  Ölçü Birimi  ", type: "text", required: true })).rejects.toThrow("zaten kayıtlı");
    await t.mutation(api.categoryAttributePresets.remove, { adminSecret: secret, id });
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page).toEqual([]);
  });

  it("requires administrator credentials and bounded page sizes", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.categoryAttributePresets.listAdmin, { ...args, adminSecret: "invalid" })).rejects.toThrow("doğrulanamadı");
    await expect(t.query(api.categoryAttributePresets.listAdmin, { ...args, paginationOpts: { ...args.paginationOpts, numItems: 1000 } })).rejects.toThrow("1-24");
  });
});

describe("category attribute template lifecycle", () => {
  const template = { label: "Malzeme", type: "select" as const, options: [" Pamuk ", " Keten "], required: false };

  it("normalizes saved values and removes obsolete fields when changing the type", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, ...template });
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page[0]?.options).toEqual(["Pamuk", "Keten"]);
    await t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id, label: "Uzunluk", type: "number", unit: " cm ", required: true });
    const numeric = (await t.query(api.categoryAttributePresets.listAdmin, { ...args, search: "uzun" })).page[0];
    expect(numeric).toMatchObject({ _id: id, label: "Uzunluk", unit: "cm", required: true });
    expect(numeric).not.toHaveProperty("options");
    expect((await t.query(api.categoryAttributePresets.listAdmin, { ...args, search: "malzeme" })).page).toEqual([]);
    await t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id, label: "Not", type: "text", required: false });
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page[0]).not.toHaveProperty("unit");
  });

  it("allows editing the same label, rejects rename collisions, and preserves the failed record", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, ...template });
    await t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id, ...template, label: " MALZEME " });
    const otherId = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, label: "Ölçü", type: "text", required: false });
    await expect(t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id: otherId, ...template, label: "malzeme" })).rejects.toThrow("zaten kayıtlı");
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page.find((row) => row._id === otherId)?.label).toBe("Ölçü");
  });

  it("keeps copied category fields intact when their library template is edited or deleted", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, ...template });
    const attributes = [{ key: "material", ...parseAttributeTemplate(template) }];
    const categoryId = await t.mutation(api.categories.create, { adminSecret: secret, title: "Test", slug: "template-test", description: "", attributes });
    await t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id, label: "Not", type: "text", required: true });
    await t.mutation(api.categoryAttributePresets.remove, { adminSecret: secret, id });
    await t.mutation(api.categoryAttributePresets.remove, { adminSecret: secret, id });
    const category = await t.query(api.categories.getBySlug, { slug: "template-test" });
    expect(category?._id).toBe(categoryId);
    expect(category?.attributes).toEqual(attributes);
    await expect(t.mutation(api.categoryAttributePresets.update, { adminSecret: secret, id, ...template })).rejects.toThrow("bulunamadı");
  });

  it("rejects unauthorized create, update and delete operations", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, ...template });
    await expect(t.mutation(api.categoryAttributePresets.create, { adminSecret: "invalid", ...template })).rejects.toThrow("doğrulanamadı");
    await expect(t.mutation(api.categoryAttributePresets.update, { adminSecret: "invalid", id, ...template })).rejects.toThrow("doğrulanamadı");
    await expect(t.mutation(api.categoryAttributePresets.remove, { adminSecret: "invalid", id })).rejects.toThrow("doğrulanamadı");
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page).toHaveLength(1);
  });

  it.each([
    { ...template, label: " " },
    { ...template, options: [] },
    { ...template, options: [" İPEK ", "ipek"] },
    { ...template, options: [" "] },
    { ...template, label: "x".repeat(81) },
    { ...template, options: Array.from({ length: 101 }, (_, index) => `Seçenek ${index}`) },
    { ...template, unit: "cm" },
    { ...template, type: "text" as const },
    { ...template, type: "number" as const, options: undefined, unit: "x".repeat(21) },
  ])("rejects invalid templates consistently in categories and library mutations: %j", async (invalid) => {
    const t = convexTest(schema, modules);
    expect(() => parseAttributeTemplate(invalid)).toThrow();
    expect(() => parseCategoryAttributes([{ key: "material", ...invalid }])).toThrow();
    await expect(t.mutation(api.categoryAttributePresets.create, { adminSecret: secret, ...invalid })).rejects.toThrow();
    await expect(t.mutation(api.categories.create, { adminSecret: secret, title: "Test", slug: "invalid-test", description: "", attributes: [{ key: "material", ...invalid }] })).rejects.toThrow();
    expect((await t.query(api.categoryAttributePresets.listAdmin, args)).page).toEqual([]);
  });
});
