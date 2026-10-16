import { describe, expect, it } from "vitest";
import {
  isVariantSellable,
  getVariantStock,
  getProductPriceRange,
  getSelectedVariant,
  getProductUnitPrice,
  getProductVariantTitle,
  canSelectOption,
  hasVariantOptionCombination,
  MAX_CART_QUANTITY,
} from "./variants";
import type { Product, ProductVariant } from "./types";

const mockVariant1: ProductVariant = {
  id: "var-1",
  title: "Kırmızı / S",
  price: { amount: "100.00", currencyCode: "TRY" },
  availableForSale: true,
  stockQuantity: 5,
  selectedOptions: [
    { name: "Renk", value: "Kırmızı" },
    { name: "Beden", value: "S" },
  ],
};

const mockVariant2: ProductVariant = {
  id: "var-2",
  title: "Mavi / M",
  price: { amount: "150.00", currencyCode: "TRY" },
  availableForSale: false,
  stockQuantity: 0,
  selectedOptions: [
    { name: "Renk", value: "Mavi" },
    { name: "Beden", value: "M" },
  ],
};

const mockProduct: Product = {
  id: "prod-1",
  slug: "ornek-tisort",
  title: "Örnek Tişört",
  description: "Açıklama",
  price: "100.00",
  availableForSale: true,
  images: [],
  options: [
    { id: "opt-1", name: "Renk", values: ["Kırmızı", "Mavi"] },
    { id: "opt-2", name: "Beden", values: ["S", "M"] },
  ],
  variants: [mockVariant1, mockVariant2],
};

describe("variants catalog helpers", () => {
  describe("isVariantSellable", () => {
    it("returns true only when availableForSale is true and stock > 0", () => {
      expect(isVariantSellable(mockVariant1)).toBe(true);
      expect(isVariantSellable(mockVariant2)).toBe(false);
      expect(isVariantSellable({ id: "var-3", availableForSale: true, stockQuantity: 0 })).toBe(false);
    });
  });

  describe("getVariantStock", () => {
    it("returns stock for specific variantId", () => {
      expect(getVariantStock(mockProduct, "var-1")).toBe(5);
      expect(getVariantStock(mockProduct, "var-2")).toBe(0);
    });

    it("returns single variant stock if no variantId is provided and only 1 variant exists", () => {
      const singleVarProduct = { variants: [mockVariant1] };
      expect(getVariantStock(singleVarProduct)).toBe(5);
    });

    it("falls back to MAX_CART_QUANTITY if stock is undefined", () => {
      const unlimitedVarProduct = { variants: [{ id: "var-u", availableForSale: true }] };
      expect(getVariantStock(unlimitedVarProduct, "var-u")).toBe(MAX_CART_QUANTITY);
    });
  });

  describe("getProductPriceRange", () => {
    it("returns min and max prices across variants", () => {
      const range = getProductPriceRange(mockProduct);
      expect(range.min).toBe("100.00");
      expect(range.max).toBe("150.00");
    });

    it("falls back to product.price if no variants exist", () => {
      const range = getProductPriceRange({ price: "79.90", variants: [] });
      expect(range.min).toBe("79.90");
      expect(range.max).toBe("79.90");
    });
  });

  describe("getSelectedVariant", () => {
    it("returns variant matching all query params", () => {
      const params = new URLSearchParams({ renk: "Kırmızı", beden: "S" });
      const found = getSelectedVariant(mockProduct, params);
      expect(found?.id).toBe("var-1");
    });

    it("returns undefined if options are incomplete or mismatched", () => {
      const params = new URLSearchParams({ renk: "Kırmızı" });
      expect(getSelectedVariant(mockProduct, params)).toBeUndefined();
    });
  });

  describe("getProductUnitPrice", () => {
    it("returns specific variant price if found", () => {
      expect(getProductUnitPrice(mockProduct, "var-2")).toBe("150.00");
    });

    it("falls back to product base price if variantId not found", () => {
      expect(getProductUnitPrice(mockProduct, "non-existent")).toBe("100.00");
    });
  });

  describe("getProductVariantTitle", () => {
    it("combines product title with variant selections", () => {
      expect(getProductVariantTitle("Örnek Tişört", mockVariant1)).toBe("Örnek Tişört — Kırmızı / S");
    });

    it("returns product title if variant has no selected options", () => {
      expect(getProductVariantTitle("Örnek Tişört", undefined)).toBe("Örnek Tişört");
    });
  });

  describe("canSelectOption and hasVariantOptionCombination", () => {
    it("evaluates option availability correctly", () => {
      const params = new URLSearchParams();
      // Kırmızı variant is available for sale
      expect(canSelectOption(mockProduct, params, "Renk", "Kırmızı")).toBe(true);
      // Mavi variant availableForSale is false
      expect(canSelectOption(mockProduct, params, "Renk", "Mavi")).toBe(false);
      // Mavi variant exists as a combination even if out of stock
      expect(hasVariantOptionCombination(mockProduct, params, "Renk", "Mavi")).toBe(true);
      // Green does not exist at all
      expect(hasVariantOptionCombination(mockProduct, params, "Renk", "Yeşil")).toBe(false);
    });
  });
});
