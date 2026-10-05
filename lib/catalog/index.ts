import type { Collection, Menu, Page, Product } from "./types";

// Local catalog data.
export const products: Product[] = [
  {
    id: "prod-hoodie-1",
    handle: "geometric-hoodie",
    availableForSale: true,
    title: "Geometrik Kapüşonlu Sweatshirt",
    description:
      "Rahat ve dökümlü kesime sahip ağır gramajlı organik pamuktan üretilmiştir. İnce geometrik dikiş detayları ve güçlendirilmiş kanguru cep içerir.",
    descriptionHtml:
      "<p>Rahat ve dökümlü kesime sahip ağır gramajlı organik pamuktan üretilmiştir. İnce geometrik dikiş detayları ve güçlendirilmiş kanguru cep içerir.</p>",
    options: [
      {
        id: "opt-size-1",
        name: "Beden",
        values: ["S", "M", "L", "XL"],
      },
      {
        id: "opt-color-1",
        name: "Renk",
        values: ["Siyah", "Melanj Gri"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "85.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "85.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-h-1",
        title: "S / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "S" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "85.00", currencyCode: "USD" },
      },
      {
        id: "var-h-2",
        title: "M / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "M" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "85.00", currencyCode: "USD" },
      },
      {
        id: "var-h-3",
        title: "L / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "L" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "85.00", currencyCode: "USD" },
      },
      {
        id: "var-h-4",
        title: "XL / Siyah",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "XL" },
          { name: "Renk", value: "Siyah" },
        ],
        price: { amount: "85.00", currencyCode: "USD" },
      },
      {
        id: "var-h-5",
        title: "M / Melanj Gri",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "M" },
          { name: "Renk", value: "Melanj Gri" },
        ],
        price: { amount: "85.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
      altText: "Geometrik Kapüşonlu Sweatshirt",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
        altText: "Geometrik Kapüşonlu Sweatshirt Ön",
        width: 1200,
        height: 1200,
      },
      {
        url: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1200&q=80",
        altText: "Geometrik Kapüşonlu Sweatshirt Detay",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Geometrik Kapüşonlu Sweatshirt",
      description:
        "Modern geometrik stile sahip birinci sınıf organik pamuk kapüşonlu sweatshirt.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-tee-2",
    handle: "minimal-tshirt",
    availableForSale: true,
    title: "Minimal Tişört",
    description:
      "Ultra ince taranmış pamuktan üretilmiş bisiklet yaka tişört. Nefes alabilir, dayanıklı ve günlük kombinler için idealdir.",
    descriptionHtml:
      "<p>Ultra ince taranmış pamuktan üretilmiş bisiklet yaka tişört. Nefes alabilir, dayanıklı ve günlük kombinler için idealdir.</p>",
    options: [
      {
        id: "opt-size-2",
        name: "Beden",
        values: ["S", "M", "L", "XL"],
      },
      {
        id: "opt-color-2",
        name: "Renk",
        values: ["Beyaz", "Siyah"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "35.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "35.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-t-1",
        title: "S / Beyaz",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "S" },
          { name: "Renk", value: "Beyaz" },
        ],
        price: { amount: "35.00", currencyCode: "USD" },
      },
      {
        id: "var-t-2",
        title: "M / Beyaz",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "M" },
          { name: "Renk", value: "Beyaz" },
        ],
        price: { amount: "35.00", currencyCode: "USD" },
      },
      {
        id: "var-t-3",
        title: "L / Beyaz",
        availableForSale: true,
        selectedOptions: [
          { name: "Beden", value: "L" },
          { name: "Renk", value: "Beyaz" },
        ],
        price: { amount: "35.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80",
      altText: "Minimal Tişört",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80",
        altText: "Minimal Tişört",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Minimal Tişört",
      description: "Modern silüete sahip kaliteli penye pamuklu tişört.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-backpack-3",
    handle: "leather-backpack",
    availableForSale: true,
    title: "Deri Sırt Çantası",
    description:
      "Suya dayanıklı birinci sınıf deriden üretilmiş, 16 inç dolgulu dizüstü bilgisayar bölmesine ve ergonomik omuz askılarına sahip sırt çantası.",
    descriptionHtml:
      "<p>Suya dayanıklı birinci sınıf deriden üretilmiş, 16 inç dolgulu dizüstü bilgisayar bölmesine ve ergonomik omuz askılarına sahip sırt çantası.</p>",
    options: [
      {
        id: "opt-color-3",
        name: "Renk",
        values: ["Konyak", "Gece Siyahı"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "140.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "140.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-b-1",
        title: "Konyak",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Konyak" }],
        price: { amount: "140.00", currencyCode: "USD" },
      },
      {
        id: "var-b-2",
        title: "Gece Siyahı",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Gece Siyahı" }],
        price: { amount: "140.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
      altText: "Deri Sırt Çantası",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
        altText: "Deri Sırt Çantası",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Deri Sırt Çantası",
      description:
        "Günlük kullanım ve seyahatler için lüks deri sırt çantası.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-cap-4",
    handle: "classic-cap",
    availableForSale: true,
    title: "Klasik Şapka",
    description:
      "Ayarlanabilir pirinç tokalı kapamaya sahip altı panelli pamuklu dimi şapka. Önceden kavis verilmiş siperlik ve zarif nakış detayları.",
    descriptionHtml:
      "<p>Ayarlanabilir pirinç tokalı kapamaya sahip altı panelli pamuklu dimi şapka. Önceden kavis verilmiş siperlik ve zarif nakış detayları.</p>",
    options: [
      {
        id: "opt-color-4",
        name: "Renk",
        values: ["Lacivert", "Zeytin Yeşili"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "28.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "28.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-c-1",
        title: "Lacivert",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Lacivert" }],
        price: { amount: "28.00", currencyCode: "USD" },
      },
      {
        id: "var-c-2",
        title: "Zeytin Yeşili",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Zeytin Yeşili" }],
        price: { amount: "28.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=80",
      altText: "Klasik Şapka",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=80",
        altText: "Klasik Şapka",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Klasik Şapka",
      description: "Zamansız altı panelli pamuk dimi beyzbol şapkası.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-sneakers-5",
    handle: "canvas-sneakers",
    availableForSale: true,
    title: "Kanvas Spor Ayakkabı",
    description:
      "Organik kanvas sayaya ve hafızalı köpük iç tabana sahip alçak profilli vulkanize kauçuk spor ayakkabı.",
    descriptionHtml:
      "<p>Organik kanvas sayaya ve hafızalı köpük iç tabana sahip alçak profilli vulkanize kauçuk spor ayakkabı.</p>",
    options: [
      {
        id: "opt-size-5",
        name: "Beden",
        values: ["40", "41", "42", "43", "44"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "110.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "110.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-sn-1",
        title: "41",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "41" }],
        price: { amount: "110.00", currencyCode: "USD" },
      },
      {
        id: "var-sn-2",
        title: "42",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "42" }],
        price: { amount: "110.00", currencyCode: "USD" },
      },
      {
        id: "var-sn-3",
        title: "43",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "43" }],
        price: { amount: "110.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80",
      altText: "Kanvas Spor Ayakkabı",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80",
        altText: "Kanvas Spor Ayakkabı",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Kanvas Spor Ayakkabı",
      description: "Alçak profilli minimalist kanvas spor ayakkabı.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-mug-6",
    handle: "insulated-mug",
    availableForSale: true,
    title: "Termos Kupa",
    description:
      "Çift duvarlı vakum yalıtımlı paslanmaz çelik seyahat kupası. Sıcak içecekleri 12 saat sıcak, soğuk içecekleri 24 saat soğuk tutar.",
    descriptionHtml:
      "<p>Çift duvarlı vakum yalıtımlı paslanmaz çelik seyahat kupası. Sıcak içecekleri 12 saat sıcak, soğuk içecekleri 24 saat soğuk tutar.</p>",
    options: [
      {
        id: "opt-color-6",
        name: "Renk",
        values: ["Mat Siyah", "Paslanmaz Çelik"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "24.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "24.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-m-1",
        title: "Mat Siyah",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Mat Siyah" }],
        price: { amount: "24.00", currencyCode: "USD" },
      },
      {
        id: "var-m-2",
        title: "Paslanmaz Çelik",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Paslanmaz Çelik" }],
        price: { amount: "24.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80",
      altText: "Termos Kupa",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80",
        altText: "Termos Kupa",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Termos Kupa",
      description: "Günlük kullanım için tasarlanmış vakum yalıtımlı termos kupa.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-beanie-7",
    handle: "wool-beanie",
    availableForSale: true,
    title: "Yün Bere",
    description:
      "Ultra ince %100 Merinos yününden örülmüş bere. Doğal olarak ısıyı dengeler, koku tutmaz ve kaşındırmaz konfor sunar.",
    descriptionHtml:
      "<p>Ultra ince %100 Merinos yününden örülmüş bere. Doğal olarak ısıyı dengeler, koku tutmaz ve kaşındırmaz konfor sunar.</p>",
    options: [
      {
        id: "opt-color-7",
        name: "Renk",
        values: ["Füme", "Karamel"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "32.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "32.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-bn-1",
        title: "Füme",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Füme" }],
        price: { amount: "32.00", currencyCode: "USD" },
      },
      {
        id: "var-bn-2",
        title: "Karamel",
        availableForSale: true,
        selectedOptions: [{ name: "Renk", value: "Karamel" }],
        price: { amount: "32.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=1200&q=80",
      altText: "Yün Bere",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=1200&q=80",
        altText: "Yün Bere",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Yün Bere",
      description: "%100 Merinos yünü fitilli bere.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "prod-runner-8",
    handle: "runner-shoes",
    availableForSale: true,
    title: "Performans Koşu Ayakkabısı",
    description:
      "Yüksek enerji geri dönüşü ve uzun mesafelerde tüy kadar hafif konfor için tasarlanmış özel file koşu ayakkabısı.",
    descriptionHtml:
      "<p>Yüksek enerji geri dönüşü ve uzun mesafelerde tüy kadar hafif konfor için tasarlanmış özel file koşu ayakkabısı.</p>",
    options: [
      {
        id: "opt-size-8",
        name: "Beden",
        values: ["41", "42", "43", "44"],
      },
    ],
    priceRange: {
      minVariantPrice: { amount: "130.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "130.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "var-rn-1",
        title: "41",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "41" }],
        price: { amount: "130.00", currencyCode: "USD" },
      },
      {
        id: "var-rn-2",
        title: "42",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "42" }],
        price: { amount: "130.00", currencyCode: "USD" },
      },
      {
        id: "var-rn-3",
        title: "43",
        availableForSale: true,
        selectedOptions: [{ name: "Beden", value: "43" }],
        price: { amount: "130.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
      altText: "Performans Koşu Ayakkabısı",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
        altText: "Performans Koşu Ayakkabısı",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Performans Koşu Ayakkabısı",
      description: "Yüksek sıçrama ve enerji dönüşümlü performans koşu ayakkabısı.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

export const collections: (Collection & { productIds: string[] })[] = [
  {
    path: "/search/hidden-homepage-featured-items",
    handle: "hidden-homepage-featured-items",
    title: "Öne Çıkanlar",
    description:
      "Ana sayfa vitrininde sergilenen öne çıkan mağaza ürünleri.",
    seo: {
      title: "Öne Çıkanlar",
      description: "Öne çıkan mağaza ürünleri.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
    productIds: ["prod-hoodie-1", "prod-tee-2", "prod-backpack-3"],
  },
  {
    path: "/search/hidden-homepage-carousel",
    handle: "hidden-homepage-carousel",
    title: "Vitrin Ürünleri",
    description: "Ana sayfa kaydırıcısında gösterilen ürünler.",
    seo: {
      title: "Vitrin Ürünleri",
      description: "Trend vitrin ürünleri.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
    productIds: [
      "prod-hoodie-1",
      "prod-tee-2",
      "prod-backpack-3",
      "prod-cap-4",
      "prod-sneakers-5",
      "prod-mug-6",
      "prod-beanie-7",
      "prod-runner-8",
    ],
  },
  {
    path: "/search/apparel",
    handle: "apparel",
    title: "Giyim",
    description:
      "Günlük lüks temel parçalar ve modern sokak modası silüetleri.",
    seo: {
      title: "Giyim Koleksiyonu",
      description: "Seçkin giyim koleksiyonumuzu keşfedin.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
    productIds: ["prod-hoodie-1", "prod-tee-2"],
  },
  {
    path: "/search/accessories",
    handle: "accessories",
    title: "Aksesuar",
    description:
      "Özenle seçilmiş deri ürünler, şapkalar ve günlük yaşam aksesuarları.",
    seo: {
      title: "Aksesuar Koleksiyonu",
      description: "El yapımı günlük aksesuar koleksiyonumuzu inceleyin.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
    productIds: [
      "prod-backpack-3",
      "prod-cap-4",
      "prod-mug-6",
      "prod-beanie-7",
    ],
  },
  {
    path: "/search/footwear",
    handle: "footwear",
    title: "Ayakkabı",
    description: "Hareket halindeyken maksimum konfor ve dayanıklılık için tasarlandı.",
    seo: {
      title: "Ayakkabı Koleksiyonu",
      description: "Premium günlük spor ayakkabılar ve koşu ayakkabıları.",
    },
    updatedAt: "2026-10-01T00:00:00Z",
    productIds: ["prod-sneakers-5", "prod-runner-8"],
  },
];

export const pages: Page[] = [
  {
    id: "page-about",
    title: "Hakkımızda",
    handle: "about",
    body: "<h2>Tasarım Performansla Buluşuyor</h2><p>Commerce yalın bir vizyonla kuruldu: mimari hassasiyet, birinci sınıf malzemeler ve detaylara gösterilen özenle temel parçalar üretmek.</p><p>Next.js 16 ve modern web standartları üzerine inşa edilen mağazamız, anında sayfa yüklemeleri, akıcı geçişler ve zahmetsiz bir alışveriş deneyimi sunmak üzere tasarlanmıştır.</p>",
    bodySummary: "Commerce'in tasarım felsefesi ve misyonu hakkında bilgi edinin.",
    seo: {
      title: "Hakkımızda | Commerce",
      description: "Modern hassasiyetle üretilmiş yenilikçi tasarım ürünleri.",
    },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "page-terms",
    title: "Kullanım Koşulları",
    handle: "terms-conditions",
    body: "<h2>Kullanım Koşulları ve Şartlar</h2><p>Commerce'e erişerek veya alışveriş yaparak bu Kullanım Koşullarını kabul etmiş olursunuz. Tüm işlemler güvenli bir şekilde işlenir ve endüstri standardı şifreleme protokolleriyle korunur.</p>",
    bodySummary: "Commerce için standart kullanım koşulları ve şartlar.",
    seo: {
      title: "Kullanım Koşulları | Commerce",
      description: "Kullanım koşullarımızı ve alışveriş yönergelerimizi okuyun.",
    },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "page-privacy",
    title: "Gizlilik Politikası",
    handle: "privacy-policy",
    body: "<h2>Gizliliğiniz Bizim İçin Önemli</h2><p>Şeffaf ve gizlilik odaklı bir ticarete inanıyoruz. Kişisel verilerinizi asla satmıyoruz. Ödeme sırasında toplanan bilgiler yalnızca siparişlerinizi hazırlamak ve teslim etmek amacıyla kullanılır.</p>",
    bodySummary: "Commerce gizlilik politikası ve müşteri verilerinin korunması.",
    seo: {
      title: "Gizlilik Politikası | Commerce",
      description:
        "Commerce'in gizliliğinize nasıl saygı duyduğunu ve koruduğunu öğrenin.",
    },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

type ProductFilters = {
  query?: string;
  sortKey?: string;
  reverse?: boolean;
};

function filterProducts(items: Product[], filters: ProductFilters): Product[] {
  const query = filters.query?.trim().toLowerCase();
  const result = items.filter(
    (product) =>
      !query ||
      `${product.title} ${product.description}`.toLowerCase().includes(query),
  );

  if (filters.sortKey === "PRICE") {
    result.sort(
      (a, b) =>
        Number(a.priceRange.minVariantPrice.amount) -
        Number(b.priceRange.minVariantPrice.amount),
    );
  }

  return filters.reverse ? result.reverse() : result;
}

export async function getProducts(filters: ProductFilters = {}) {
  return filterProducts(products, filters);
}

export async function getProduct(handle: string) {
  return products.find((product) => product.handle === handle);
}

export async function getProductRecommendations(productId: string) {
  return products.filter((product) => product.id !== productId).slice(0, 5);
}

export async function getCollections(): Promise<Collection[]> {
  return [
    {
      handle: "",
      title: "Tümü",
      description: "Tüm ürünler",
      seo: {
        title: "Tümü",
        description: "Tüm ürünler",
      },
      path: "/search",
      updatedAt: "2026-10-01T00:00:00Z",
    },
    ...collections.filter(
      (collection) => !collection.handle.startsWith("hidden-"),
    ),
  ];
}

export async function getCollection(handle: string) {
  return collections.find((collection) => collection.handle === handle);
}

export async function getCollectionProducts({
  collection,
  ...filters
}: ProductFilters & { collection: string }) {
  const entry = collections.find((c) => c.handle === collection);
  if (!entry) return [];
  return filterProducts(
    products.filter((product) => entry.productIds.includes(product.id)),
    filters,
  );
}

export async function getPage(handle: string) {
  return pages.find((page) => page.handle === handle);
}

export async function getPages() {
  return pages;
}

export async function getMenu(): Promise<Menu[]> {
  return [
    { title: "Tümü", path: "/search" },
    { title: "Giyim", path: "/search/apparel" },
    { title: "Aksesuar", path: "/search/accessories" },
    { title: "Ayakkabı", path: "/search/footwear" },
  ];
}
