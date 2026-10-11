import { describe, expect, it } from "vitest";
import { EMPTY_CATALOG_FILTERS } from "./facets";
import { createCatalogSearchParams } from "./search-params";

describe("catalog search navigation", () => {
  it("submits local filters with the new query and resets pagination", () => {
    const filters = { ...EMPTY_CATALOG_FILTERS, minPrice: "100" };
    const attributes = { material: { values: ["Pamuk"], min: "", max: "" } };
    const params = createCatalogSearchParams(
      "q=eski&sort=price-asc&page=2&cursor=old&filters=stale",
      filters,
      attributes,
      "  yeni ürün  ",
    );

    expect(params.get("q")).toBe("yeni ürün");
    expect(params.get("sort")).toBe("price-asc");
    expect(JSON.parse(params.get("filters")!)).toEqual(filters);
    expect(JSON.parse(params.get("attributes")!)).toEqual(attributes);
    expect(params.has("page")).toBe(false);
    expect(params.has("cursor")).toBe(false);
  });

  it("clears the query and filters together while preserving sorting", () => {
    const params = createCatalogSearchParams(
      "q=ürün&filters=old&attributes=old&page=3&cursor=old&sort=price-desc",
      EMPTY_CATALOG_FILTERS,
      {},
      " ",
    );

    expect(params.toString()).toBe("sort=price-desc");
  });

  it("preserves the applied query when only filters change", () => {
    const params = createCatalogSearchParams("q=ürün&cursor=old", EMPTY_CATALOG_FILTERS, {});
    expect(params.toString()).toBe("q=%C3%BCr%C3%BCn");
  });
});
