import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { insertCatalogProduct, deleteCatalogProduct } from "./catalogModel";

const initialProducts = [
  {
    slug: "geometric-hoodie",
    availableForSale: true,
    title: "Geometrik Kapüşonlu Sweatshirt",
    price: "85.00",
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
    ],
    categorySlug: "apparel",
  },
  {
    slug: "minimalist-backpack",
    availableForSale: true,
    title: "Minimalist Sırt Çantası",
    price: "115.00",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
    ],
    categorySlug: "accessories",
  },
  {
    slug: "ceramic-coffee-cup",
    availableForSale: true,
    title: "El Yapımı Seramik Fincan Seti",
    price: "42.00",
    images: [
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80",
    ],
    categorySlug: "accessories",
  },
];

const initialCategories = [
  {
    slug: "apparel",
    title: "Giyim",
    description: "Giyim ürünleri.",
    path: "/search/apparel",
  },
  {
    slug: "accessories",
    title: "Aksesuar",
    description: "Aksesuar ürünleri.",
    path: "/search/accessories",
  },
  {
    slug: "footwear",
    title: "Ayakkabı",
    description: "Ayakkabı ürünleri.",
    path: "/search/footwear",
  },
];

export const seedDatabase = mutation({
  args: {
    adminSecret: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (args.force) {
      // ponytail: 100 per table; larger datasets use dedicated batched maintenance.
      const [products, categories] = await Promise.all([
        ctx.db.query("products").take(101),
        ctx.db.query("categories").take(101),
      ]);
      if ([products, categories].some((rows) => rows.length > 100)) {
        throw new Error("Örnek veri sıfırlama tablo başına en fazla 100 kayıt destekler. Daha büyük veri için ayrı toplu bakım kullanın.");
      }
      for (const product of products) await deleteCatalogProduct(ctx, product);
      for (const category of categories) await ctx.db.delete(category._id);
    } else {
      const existing = await Promise.all([
        ctx.db.query("products").first(),
        ctx.db.query("categories").first(),
      ]);
      if (existing.some(Boolean)) return "Veritabanında zaten veriler mevcut.";
    }
    const updatedAt = new Date().toISOString();

    for (const prod of initialProducts) {
      await insertCatalogProduct(ctx, { ...prod, updatedAt });
    }

    for (const cat of initialCategories) {
      await ctx.db.insert("categories", { ...cat, updatedAt });
    }

    return "Örnek veriler yüklendi.";
  },
});
