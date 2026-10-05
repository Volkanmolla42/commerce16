import { expect, test } from "vitest";
import { parseProductInput, parsePageInput } from "./input";

const product = { title: " Ürün ", slug: "urun", price: "12.5", images: [], storageImages: [], options: [], variants: [], availableForSale: true };
test("normalizes product prices and uses the same complete shape for create/update", () => {
  expect(parseProductInput(product)).toMatchObject({ title: "Ürün", price: "12.50", categorySlug: "", seo: { title: "", description: "" } });
  expect(() => parseProductInput({ ...product, price: "-1" })).toThrow();
  expect(() => parseProductInput({ ...product, images: Array(21).fill("https://example.com/image.webp") })).toThrow();
});
test("rejects a variant that repeats one option instead of supplying every option", () => {
  expect(() => parseProductInput({ ...product,
    options: [{ id: "1", name: "Beden", values: ["S"] }, { id: "2", name: "Renk", values: ["Siyah"] }],
    variants: [{ id: "variant", title: "S", price: "12.50", availableForSale: true,
      selectedOptions: [{ name: "Beden", value: "S" }, { name: "Beden", value: "S" }] }],
  })).toThrow("Varyant seçenekleri eksik");
});
test("sanitizes CMS writes and rejects oversized content", () => {
  const page = { title: "Hakkımızda", slug: "about", bodySummary: "Özet", body: '<p onclick="evil()">Merhaba</p><script>alert(1)</script><a href="javascript:evil()">Link</a>' };
  expect(parsePageInput(page).body).toBe("<p>Merhaba</p><a>Link</a>");
  expect(() => parsePageInput({ ...page, body: "a".repeat(100_001) })).toThrow();
});
