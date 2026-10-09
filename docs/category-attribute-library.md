# Kategori özellik kütüphanesi

Kütüphane tek bir özelliğin yeniden kullanılabilir şablonunu saklar. Kategoriye eklenirken yeni bir `key` üretilir ve bilgiler kopyalanır. Şablon ile kategori arasında canlı bağlantı yoktur; şablonu düzenlemek veya silmek mevcut kategorileri ve ürün değerlerini değiştirmez.

## Kodun yerleşimi

- `lib/catalog/attributes.ts`: ortak tipler, tür adları, sınırlar, Türkçe ad normalizasyonu ve girdi doğrulama. `parseAttributeTemplate` kütüphane girdisini; `parseCategoryAttributes` kategori listesini doğrular ve temizler.
- `convex/schema.ts`: kategori ve kütüphane için aynı özellik alanları. Mevcut veri yapısı korunur; veri taşıma gerekmez.
- `convex/categoryAttributePresets.ts`: yönetici doğrulaması, oluşturma, güncelleme, silme ve indeksli arama/sayfalama. Güncellemede artık kullanılmayan seçenek ve birim alanları silinir.
- `app/api/admin/route.ts`: oturum kontrolünden sonra aynı ayrıştırıcıyla HTTP girdisini doğrular. İşlemler: `category-attribute-preset.create`, `.update`, `.delete`.
- `app/admin/categories/_components/category-attribute-fields.tsx`: kategori ve kütüphane düzenleyicilerinin ortak alanları.
- `app/admin/categories/_components/category-attribute-library.tsx`: arama, sayfalama, doğrudan ekleme ve kayıt yönetimi. Silme öncesinde onay gösterilir; kategoriye zaten eklenmiş adlar tekrar eklenemez.

Kategori başına 30 özellik, seçim özelliği başına 100 seçenek sınırı vardır. Özellik adları en fazla 80, birimler en fazla 20 karakterdir. Ad benzersizliği Türkçe büyük/küçük harf kurallarıyla kontrol edilir. Yönetim ekranı sayfa başına 8 kayıt gösterir; backend en fazla 24 kayda izin verir.

Kütüphane kayıtları ayrı kaydedilir. Kategoriye ekleme ve kategori alanlarında yapılan değişiklikler için kategori formunun da kaydedilmesi gerekir. Bir kütüphane taslağı açıkken kategori kaydı bekletilir; önce taslağı kaydedin veya iptal edin.

## Doğrulama

`npm test` kütüphane CRUD işlemlerini, yetkisiz erişimi, Türkçe aramayı, büyük listelerde sayfalamayı, tür değişikliğinde alan temizliğini ve kategori kopyalarının korunmasını sınar. TypeScript için `npx tsc --noEmit` kullanılır. Backend değişiklikleri uygulamanın kullandığı Convex geliştirme dağıtımına da gönderilmelidir.
