import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
  },
];

export const seedDatabase = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (args.force) {
      const allP = await ctx.db.query("products").collect();
      for (const p of allP) await ctx.db.delete(p._id);

      const allCat = await ctx.db.query("categories").collect();
      for (const cat of allCat) await ctx.db.delete(cat._id);

      const allPg = await ctx.db.query("pages").collect();
      for (const pg of allPg) await ctx.db.delete(pg._id);
    } else {
      const existing = await ctx.db.query("products").first();
      if (existing) {
        return "Veritabanında zaten veriler mevcut.";
      }
    }

    for (const prod of initialProducts) {
      await ctx.db.insert("products", prod);
    }

    for (const cat of initialCategories) {
      await ctx.db.insert("categories", cat);
    }

    for (const pg of initialPages) {
      await ctx.db.insert("pages", pg);
    }

    return "Tüm ürünler, kategoriler ve sayfalar Convex veritabanına başarıyla yüklendi!";
  },
});
