/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const product = { slug: "test-product", title: "Katalog ürünü", price: "12.35", availableForSale: true, images: ["https://example.com/catalog.webp"], updatedAt: "2026-10-05" };
const address = { title: "Ev", fullName: "Test Müşteri", phone: "555", city: "Rize", district: "Merkez", addressLine1: "Test adresi", isDefault: false };
const customer = { customerName: "Test Müşteri", customerEmail: "test@example.com" };

beforeEach(() => vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret"));
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  const { productId, userId, otherUserId } = await t.run(async (ctx) => ({
    productId: await ctx.db.insert("products", product),
    userId: await ctx.db.insert("users", { name: "Müşteri" }),
    otherUserId: await ctx.db.insert("users", { name: "Başka müşteri" }),
  }));
  const owner = t.withIdentity({ subject: userId });
  const args = { ...customer, items: [{ productId, title: "İstemciden sahte başlık", price: "12.35", quantity: 2, image: "https://example.com/fake.webp" }], total: "24.70" };
  return { t, owner, productId, userId, otherUserId, args };
}

describe("Sipariş sınırı", () => {
  test("guest oluşturabilir, snapshot katalogdan gelir ve guest detay okuyamaz", async () => {
    const { t, args } = await fixture();
    const id = await t.mutation(api.orders.createOrder, args);
    const order = await t.run((ctx) => ctx.db.get(id));
    expect(order).toMatchObject({ total: "24.70", status: "pending", items: [{ title: product.title, image: product.images[0], price: "12.35", quantity: 2 }] });
    expect(await t.query(api.orders.getOrderById, { id })).toBeNull();
  });
  test("sadece authenticated owner sipariş detayını okuyabilir", async () => {
    const { t, owner, args, otherUserId } = await fixture();
    const id = await owner.mutation(api.orders.createOrder, args);
    expect(await owner.query(api.orders.getOrderById, { id })).toMatchObject({ _id: id });
    expect(await t.query(api.orders.getOrderById, { id })).toBeNull();
    expect(await t.withIdentity({ subject: otherUserId }).query(api.orders.getOrderById, { id })).toBeNull();
  });
  test.each([0, -1, 1.5, 1000, NaN])("geçersiz quantity %s reddedilir ve order yazılmaz", async (quantity) => {
    const { t, args } = await fixture();
    await expect(t.mutation(api.orders.createOrder, { ...args, items: [{ ...args.items[0], quantity }] })).rejects.toThrow("Ürün adedi");
    expect(await t.run((ctx) => ctx.db.query("orders").first())).toBeNull();
  });
  test("fiyat ve toplam manipülasyonu reddedilir", async () => {
    const { t, args } = await fixture();
    await expect(t.mutation(api.orders.createOrder, { ...args, items: [{ ...args.items[0], price: "0.01" }] })).rejects.toThrow("Sepet fiyatı");
    await expect(t.mutation(api.orders.createOrder, { ...args, total: "0.02" })).rejects.toThrow("Sepet tutarı");
  });
  test("satış dışı ürün ve eksik/yanlış variant reddedilir; variant fiyatı kaydedilir", async () => {
    const { t, productId, args } = await fixture();
    await t.run((ctx) => ctx.db.patch(productId, { availableForSale: false }));
    await expect(t.mutation(api.orders.createOrder, args)).rejects.toThrow("satışa uygun");
    await t.run((ctx) => ctx.db.patch(productId, { availableForSale: true, variants: [{ id: "large", title: "L", availableForSale: true, selectedOptions: [{ name: "Beden", value: "L" }], price: "15.00" }] }));
    await expect(t.mutation(api.orders.createOrder, args)).rejects.toThrow("seçeneği");
    await expect(t.mutation(api.orders.createOrder, { ...args, items: [{ ...args.items[0], variantId: "unknown" }] })).rejects.toThrow("seçeneği");
    const id = await t.mutation(api.orders.createOrder, { ...args, total: "30.00", items: [{ ...args.items[0], variantId: "large", price: "15.00" }] });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ total: "30.00", items: [{ variantId: "large", price: "15.00" }] });
  });
});

describe("Adres defteri", () => {
  test("checkout ve adres API aynı default kurallarını kullanır", async () => {
    const { owner, args } = await fixture();
    const first = await owner.mutation(api.addresses.addAddress, address);
    await owner.mutation(api.orders.createOrder, { ...args, saveAddress: { title: "İş", city: "Rize", district: "Merkez", addressLine1: "Yeni adres", isDefault: true } });
    const addresses = await owner.query(api.addresses.getMyAddresses);
    expect(addresses.filter((item) => item.isDefault)).toHaveLength(1);
    expect(addresses[0].title).toBe("İş");
    await owner.mutation(api.addresses.deleteAddress, { addressId: addresses[0]._id });
    expect(await owner.query(api.addresses.getMyAddresses)).toMatchObject([{ _id: first, isDefault: true }]);
    await owner.mutation(api.addresses.updateAddress, { ...address, addressId: first });
    expect(await owner.query(api.addresses.getMyAddresses)).toMatchObject([{ isDefault: true }]);
  });
  test("ownership korunur; 101. adres insert/checkout transaction reddedilir", async () => {
    const { t, owner, userId, otherUserId, args } = await fixture();
    const first = await owner.mutation(api.addresses.addAddress, address);
    await expect(t.withIdentity({ subject: otherUserId }).mutation(api.addresses.deleteAddress, { addressId: first })).rejects.toThrow("yetkiniz yok");
    await t.run(async (ctx) => { for (let i = 0; i < 99; i++) await ctx.db.insert("addresses", { ...address, userId }); });
    await expect(owner.mutation(api.addresses.addAddress, address)).rejects.toThrow("100 adres");
    await expect(owner.mutation(api.orders.createOrder, { ...args, saveAddress: { title: "Ev", city: "Rize", district: "Merkez", addressLine1: "Yeni" } })).rejects.toThrow("100 adres");
    expect(await t.run((ctx) => ctx.db.query("orders").first())).toBeNull();
  });
});

describe("Katalog ve kategori", () => {
  test("admin storage metadata korunur; public hydrated url gösterir", async () => {
    const { t, productId } = await fixture();
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["webp"], { type: "image/webp" }));
      await ctx.db.patch(productId, { storageImages: [{ storageId: id, fileName: "test-product.webp" }] });
      return id;
    });
    const items = await t.query(api.products.listAllAdmin, { adminSecret: "test-admin-secret" });
    expect(items[0].storageImages).toMatchObject([{ storageId, fileName: "test-product.webp", url: expect.any(String) }]);
    const publicProduct = await t.query(api.products.getBySlug, { slug: product.slug });
    expect(publicProduct).not.toHaveProperty("storageImages");
    expect(publicProduct?.images).toHaveLength(2);
  });
  test("kullanılan kategori rename engellenir; diğer alanlar güncellenebilir", async () => {
    const { t, productId } = await fixture();
    const id = await t.run(async (ctx) => {
      await ctx.db.patch(productId, { categorySlug: "giyim" });
      return await ctx.db.insert("categories", { slug: "giyim", title: "Giyim", description: "", path: "/search/giyim", seo: { title: "Giyim", description: "" }, updatedAt: "2026-10-05" });
    });
    await expect(t.mutation(api.categories.update, { adminSecret: "test-admin-secret", id, slug: "yeni" })).rejects.toThrow("Kullanılan kategorinin");
    await t.mutation(api.categories.update, { adminSecret: "test-admin-secret", id, title: "Yeni başlık" });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ slug: "giyim", title: "Yeni başlık" });
  });
  test("category query geneldeki 100 ürün sınırından bağımsız ve storage DTO gizli", async () => {
    const { t, productId } = await fixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) await ctx.db.insert("products", { ...product, slug: "p-" + i, categorySlug: "other" });
      const storageId = await ctx.storage.store(new Blob(["webp-content"], { type: "image/webp" }));
      await ctx.db.patch(productId, { categorySlug: "target", storageImages: [{ storageId, fileName: "test-product.webp" }] });
    });
    const items = await t.query(api.products.list, { categorySlug: "target", limit: 1000 });
    expect(items).toHaveLength(1);
    expect(items[0]._id).toBe(productId);
    expect(items[0]).not.toHaveProperty("storageImages");
    expect(items[0].images).toHaveLength(2);

    expect(await t.query(api.products.list, { limit: 1000 })).toHaveLength(100);
    expect(await t.query(api.products.list, { limit: 0 })).toHaveLength(1);
    await expect(t.query(api.products.list, { limit: Infinity })).rejects.toThrow("Ürün limiti");
  });
});


describe("Seed sınırı", () => {
  test.each(["categories", "pages"] as const)("kısmi %s verisi varken nonforce seed no-op", async (table) => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => table === "categories"
      ? await ctx.db.insert("categories", { slug: "existing", title: "Mevcut", description: "", path: "/search/existing", seo: { title: "Mevcut", description: "" }, updatedAt: "2026-01-01" })
      : await ctx.db.insert("pages", { slug: "existing", title: "Mevcut", body: "", bodySummary: "", updatedAt: "2026-01-01" }));
    await t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret" });
    await t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret" });
    const snapshot = await t.run(async (ctx) => ({ products: await ctx.db.query("products").take(101), categories: await ctx.db.query("categories").take(101), pages: await ctx.db.query("pages").take(101) }));
    expect(snapshot.products).toHaveLength(0);
    expect(snapshot[table]).toMatchObject([{ _id: id }]);
    expect(snapshot[table === "pages" ? "categories" : "pages"]).toHaveLength(0);
  });
  test.each(["products", "categories", "pages"] as const)("force %s 101 kayıt varken hiçbir tabloyu değiştirmez", async (table) => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("products", product);
      await ctx.db.insert("categories", { slug: "existing", title: "Mevcut", description: "", path: "/search/existing", seo: { title: "Mevcut", description: "" }, updatedAt: "2026-01-01" });
      await ctx.db.insert("pages", { slug: "existing", title: "Mevcut", body: "", bodySummary: "", updatedAt: "2026-01-01" });
      for (let i = 0; i < 100; i++) {
        if (table === "products") await ctx.db.insert("products", { ...product, slug: "p-" + i });
        else if (table === "categories") await ctx.db.insert("categories", { slug: "c-" + i, title: "Mevcut", description: "", path: "/search/existing", seo: { title: "Mevcut", description: "" }, updatedAt: "2026-01-01" });
        else await ctx.db.insert("pages", { slug: "page-" + i, title: "Mevcut", body: "", bodySummary: "", updatedAt: "2026-01-01" });
      }
    });
    const snapshot = () => t.run(async (ctx) => ({ products: await ctx.db.query("products").take(101), categories: await ctx.db.query("categories").take(101), pages: await ctx.db.query("pages").take(101) }));
    const before = await snapshot();
    await expect(t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret", force: true })).rejects.toThrow("100 kayıt");
    expect(await snapshot()).toEqual(before);
  });
  test("boş seed idempotent; reset bütün fixturelara aynı güncel timestamp yazar", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret" });
    await t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret" });
    await t.mutation(api.seed.seedDatabase, { adminSecret: "test-admin-secret", force: true });
    const snapshot = await t.run(async (ctx) => ({ products: await ctx.db.query("products").take(101), categories: await ctx.db.query("categories").take(101), pages: await ctx.db.query("pages").take(101) }));
    expect(snapshot.products).toHaveLength(3);
    expect(snapshot.categories).toHaveLength(3);
    expect(snapshot.pages).toHaveLength(3);
    expect(new Set([...snapshot.products, ...snapshot.categories, ...snapshot.pages].map((row) => row.updatedAt)).size).toBe(1);
  });
});
