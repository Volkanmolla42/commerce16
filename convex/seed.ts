import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

const initialProducts = [
  {
    slug: "geometric-hoodie",
    availableForSale: true,
    title: "Geometrik Kapüşonlu Sweatshirt",
    price: "85.00",
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
    ],
    seo: {
      title: "Geometrik Kapüşonlu Sweatshirt",
      description: "Ağır gramajlı organik pamuk kapüşonlu sweatshirt.",
    },
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
    seo: {
      title: "Minimalist Sırt Çantası",
      description: "Suya dayanıklı 16 inç laptop bölmeli şehir sırt çantası.",
    },
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
    seo: {
      title: "El Yapımı Seramik Fincan Seti",
      description: "Geleneksel el yapımı seramik fincan.",
    },
    categorySlug: "accessories",
  },
];

const initialCategories = [
  {
    slug: "apparel",
    title: "Giyim",
    description: "Günlük lüks temel parçalar ve modern sokak modası silüetleri.",
    path: "/search/apparel",
    seo: {
      title: "Giyim Kategorisi",
      description: "Seçkin giyim ürünlerimizi keşfedin.",
    },
  },
  {
    slug: "accessories",
    title: "Aksesuar",
    description: "Özenle seçilmiş deri ürünler, şapkalar ve günlük yaşam aksesuarları.",
    path: "/search/accessories",
    seo: {
      title: "Aksesuar Kategorisi",
      description: "El yapımı günlük aksesuar ürünlerimizi inceleyin.",
    },
  },
  {
    slug: "footwear",
    title: "Ayakkabı",
    description: "Maksimum konfor ve dayanıklılık için tasarlandı.",
    path: "/search/footwear",
    seo: {
      title: "Ayakkabı Kategorisi",
      description: "Premium günlük ayakkabılar.",
    },
  },
];

const initialPages = [
  {
    title: "Hakkımızda",
    slug: "about",
    body: "<h2>Tasarım Performansla Buluşuyor</h2><p>Commerce yalın bir vizyonla kuruldu: mimari hassasiyet, birinci sınıf malzemeler ve detaylara gösterilen özenle temel parçalar üretmek.</p>",
    bodySummary: "Commerce'in tasarım felsefesi ve misyonu hakkında bilgi edinin.",
    seo: {
      title: "Hakkımızda | Commerce",
      description: "Modern hassasiyetle üretilmiş yenilikçi tasarım ürünleri.",
    },
  },
  {
    title: "Kullanım Koşulları",
    slug: "terms-conditions",
    body: "<h2>Kullanım Koşulları ve Şartlar</h2><p>Commerce'e erişerek veya alışveriş yaparak bu Kullanım Koşullarını kabul etmiş olursunuz.</p>",
    bodySummary: "Commerce için standart kullanım koşulları ve şartlar.",
    seo: {
      title: "Kullanım Koşulları | Commerce",
      description: "Kullanım koşullarımızı ve alışveriş yönergelerimizi okuyun.",
    },
  },
  {
    title: "Gizlilik Politikası",
    slug: "privacy-policy",
    body: "<h2>Gizliliğiniz Bizim İçin Önemli</h2><p>Şeffaf ve gizlilik odaklı bir ticarete inanıyoruz. Kişisel verilerinizi asla satmıyoruz.</p>",
    bodySummary: "Commerce gizlilik politikası ve müşteri verilerinin korunması.",
    seo: {
      title: "Gizlilik Politikası | Commerce",
      description: "Commerce gizlilik politikası.",
    },
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
      const [products, categories, pages] = await Promise.all([
        ctx.db.query("products").take(101),
        ctx.db.query("categories").take(101),
        ctx.db.query("pages").take(101),
      ]);
      if ([products, categories, pages].some((rows) => rows.length > 100)) {
        throw new Error("Örnek veri sıfırlama tablo başına en fazla 100 kayıt destekler. Daha büyük veri için ayrı toplu bakım kullanın.");
      }
      for (const row of [...products, ...categories, ...pages]) await ctx.db.delete(row._id);
    } else {
      const existing = await Promise.all([
        ctx.db.query("products").first(),
        ctx.db.query("categories").first(),
        ctx.db.query("pages").first(),
      ]);
      if (existing.some(Boolean)) return "Veritabanında zaten veriler mevcut.";
    }
    const updatedAt = new Date().toISOString();

    for (const prod of initialProducts) {
      await ctx.db.insert("products", { ...prod, updatedAt });
    }

    for (const cat of initialCategories) {
      await ctx.db.insert("categories", { ...cat, updatedAt });
    }

    for (const pg of initialPages) {
      await ctx.db.insert("pages", { ...pg, updatedAt });
    }

    return "Tüm ürünler, kategoriler ve sayfalar Convex veritabanına başarıyla yüklendi!";
  },
});
