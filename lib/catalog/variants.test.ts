import { expect, test } from "vitest";
import { canSelectOption, getSelectedVariant } from "./variants";
import type { Product } from "./types";

const product: Product = {
  id: "shirt", slug: "shirt", title: "Tişört", price: "100.00", images: [], availableForSale: true, updatedAt: "2026-10-05",
  options: [{ id: "size", name: "Beden", values: ["S", "M"] }, { id: "color", name: "Renk", values: ["Siyah"] }],
  variants: ["S", "M"].map((size) => ({ id: size, title: size, availableForSale: true,
    selectedOptions: [{ name: "Beden", value: size }, { name: "Renk", value: "Siyah" }], price: { amount: "120.00", currencyCode: "TRY" } })),
};
test("resolves a complete variant including implicit single-value options", () => {
  expect(getSelectedVariant(product, new URLSearchParams("beden=M&image=2"))?.id).toBe("M");
});
test("enables only available combinations while ignoring unrelated URL parameters", () => {
  const unavailable = { ...product, variants: product.variants!.map((variant) => ({ ...variant, availableForSale: variant.id !== "M" })) };
  expect(canSelectOption(unavailable, new URLSearchParams("image=1"), "Beden", "M")).toBe(false);
  expect(canSelectOption(unavailable, new URLSearchParams("image=1&renk=Siyah"), "Beden", "S")).toBe(true);
  expect(canSelectOption(product, new URLSearchParams("beden=M"), "Renk", "Siyah")).toBe(true);
});
test("does not invent a variant for an incomplete or invalid selection", () => {
  expect(getSelectedVariant(product, new URLSearchParams())).toBeUndefined();
  expect(getSelectedVariant(product, new URLSearchParams("beden=XL"))).toBeUndefined();
  expect(getSelectedVariant(product, new URLSearchParams("beden=S&renk=Beyaz"))).toBeUndefined();
});
