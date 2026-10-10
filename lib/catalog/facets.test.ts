import { describe, expect, it } from "vitest";
import {
  matchesCatalogFilters,
  matchesOptionFilters,
  getActiveCatalogFilterCount,
  getOptionKind,
  sortOptionValues,
} from "./facets";
import type { Product } from "./types";

describe("Option & Variant Filtering", () => {
  const sampleProduct: Product = {
    id: "p1",
    slug: "etek",
    title: "Ekose Etek",
    price: "888.00",
    availableForSale: true,
    updatedAt: "2026-01-01",
    images: [],
    options: [
      { id: "opt-1", name: "Beden", values: ["M", "L", "XL"] },
      { id: "opt-2", name: "Renk", values: ["Kırmızı", "Siyah"] },
    ],
    variants: [
      {
        id: "v1",
        title: "M / Kırmızı",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "M" },
          { name: "Renk", value: "Kırmızı" },
        ],
        price: { amount: "888.00", currencyCode: "TRY" },
        // in stock
        ...({ stockQuantity: 5 } as unknown as object),
      },
      {
        id: "v2",
        title: "M / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "M" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "888.00", currencyCode: "TRY" },
        // out of stock!
        ...({ stockQuantity: 0 } as unknown as object),
      },
      {
        id: "v3",
        title: "L / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "L" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "888.00", currencyCode: "TRY" },
        // in stock
        ...({ stockQuantity: 2 } as unknown as object),
      },
      {
        id: "v4",
        title: "XL / Kırmızı",
        availableForSale: false, // not available for sale
        selectedOptions: [
          { name: "Beden", value: "XL" },
          { name: "Renk", value: "Kırmızı" },
        ],
        price: { amount: "888.00", currencyCode: "TRY" },
        ...({ stockQuantity: 10 } as unknown as object),
      },
    ],
  };

  it("matches when no option filters are active", () => {
    expect(matchesOptionFilters(sampleProduct, {})).toBe(true);
    expect(matchesOptionFilters(sampleProduct, undefined)).toBe(true);
  });

  it("filters by single in-stock size", () => {
    // M is in stock via variant v1 (M / Kırmızı)
    expect(matchesOptionFilters(sampleProduct, { Beden: ["M"] })).toBe(true);
    // L is in stock via variant v3 (L / Siyah)
    expect(matchesOptionFilters(sampleProduct, { Beden: ["L"] })).toBe(true);
    // XL is availableForSale: false
    expect(matchesOptionFilters(sampleProduct, { Beden: ["XL"] })).toBe(false);
    // S is not an option
    expect(matchesOptionFilters(sampleProduct, { Beden: ["S"] })).toBe(false);
  });

  it("filters by multiple sizes (OR logic within same option)", () => {
    expect(matchesOptionFilters(sampleProduct, { Beden: ["S", "M"] })).toBe(true);
    expect(matchesOptionFilters(sampleProduct, { Beden: ["S", "XL"] })).toBe(false);
  });

  it("filters by combination of options (AND logic across dimensions)", () => {
    // M and Kırmızı: v1 has stock 5 -> true
    expect(matchesOptionFilters(sampleProduct, { Beden: ["M"], Renk: ["Kırmızı"] })).toBe(true);

    // M and Siyah: v2 has stock 0 -> false!
    expect(matchesOptionFilters(sampleProduct, { Beden: ["M"], Renk: ["Siyah"] })).toBe(false);

    // L and Siyah: v3 has stock 2 -> true
    expect(matchesOptionFilters(sampleProduct, { Beden: ["L"], Renk: ["Siyah"] })).toBe(true);
  });

  it("is case-insensitive and handles trimmed option names", () => {
    expect(matchesOptionFilters(sampleProduct, { beden: ["m"] })).toBe(false); // value is exact "M"
    expect(matchesOptionFilters(sampleProduct, { " beden ": ["M"] })).toBe(true);
  });

  it("matchesCatalogFilters combines price and option filters", () => {
    expect(
      matchesCatalogFilters(sampleProduct, {
        minPrice: "500",
        maxPrice: "1000",
        options: { Beden: ["M"] },
      })
    ).toBe(true);

    expect(
      matchesCatalogFilters(sampleProduct, {
        minPrice: "900",
        maxPrice: "1000",
        options: { Beden: ["M"] },
      })
    ).toBe(false);
  });

  it("counts active filters correctly", () => {
    expect(
      getActiveCatalogFilterCount({
        minPrice: "",
        maxPrice: "",
        options: {},
      })
    ).toBe(0);

    expect(
      getActiveCatalogFilterCount({
        minPrice: "100",
        maxPrice: "",
        options: {
          Beden: ["M", "L"],
          Renk: ["Siyah"],
        },
      })
    ).toBe(4); // 1 price + 2 sizes + 1 color
  });

  it("classifies option kinds correctly", () => {
    expect(getOptionKind("Beden")).toBe("size");
    expect(getOptionKind("size")).toBe("size");
    expect(getOptionKind("Numara")).toBe("size");
    expect(getOptionKind("Renk")).toBe("color");
    expect(getOptionKind("color")).toBe("color");
    expect(getOptionKind("Materyal")).toBe("general");
    expect(getOptionKind("Kalıp")).toBe("general");
  });

  it("sorts clothing sizes in natural order", () => {
    const sorted = sortOptionValues("Beden", ["XL", "M", "XS", "S", "L", "XXL"]);
    expect(sorted).toEqual(["xs", "s", "m", "l", "xl", "xxl"].map((s) => s.toUpperCase()));
  });

  it("sorts numeric sizes numerically", () => {
    const sorted = sortOptionValues("Numara", ["42", "38", "40", "36"]);
    expect(sorted).toEqual(["36", "38", "40", "42"]);
  });

  it("sorts general options alphabetically with Turkish locale", () => {
    const sorted = sortOptionValues("Renk", ["Siyah", "Beyaz", "Kırmızı", "Mavi"]);
    expect(sorted).toEqual(["Beyaz", "Kırmızı", "Mavi", "Siyah"]);
  });
});
