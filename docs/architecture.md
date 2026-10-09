# Mimari

`app/(storefront)` vitrin ve müşteri akışlarını, `app/admin` yönetim ekranlarını içerir. Rota grubu URL'leri değiştirmez. Ortak tasarım öğeleri `components/ui` içinde kalır.

## Modüller ve arayüzler

- **Katalog:** `lib/catalog` Convex belgelerini vitrin modeline dönüştürür. Kategori filtresi Convex indeksinde uygulanır. Ürün ve kategori yazımları ilgili önbellek etiketlerini yeniler; CMS ve mağaza ayarı etiketleri ayrı tutulur.
- **Sepet:** `components/cart/cart-store.ts` ürün ve varyant kimliklerini, adetleri ve tarayıcı depolamasını yönetir. `CartProvider`, `useSyncExternalStore` ile sepete abone olur. Kalıcı JSON güvenilmeyen girdi olarak doğrulanır; tarayıcı depolaması kapalıysa sepet bellekte çalışır.
- **Sipariş:** `convex/orders.ts` katalog fiyatını ve satış durumunu aynı transaction içinde doğrular, tutarı kuruş olarak hesaplar ve sipariş anındaki ürün bilgilerini kaydeder. İstemcinin gönderdiği fiyat veya toplam güncel değilse sipariş reddedilir. Sipariş ayrıntılarını yalnızca oturum sahibi okuyabilir; misafir siparişi sonuç sayfasında görüntülenir.
- **Adres defteri:** `convex/addresses.ts` adres sahipliğini ve varsayılan adres kurallarını yönetir. Ödeme akışı da `insertAddress` işlevini kullanır.
- **Şema:** `convex/schema.ts` veri yapılarının tek kaynağıdır. Girdi ve dönüş doğrulayıcıları `schema.doc()` üzerinden türetilir; vitrin ve yönetimde kullanılan görsel veri tipleri ihtiyaca göre daraltılır.
- **Yönetim girdileri:** `lib/admin/input.ts` HTTP girdilerini doğrular ve CMS HTML'ini temizler. Oluşturma ve güncelleme aynı ayrıştırıcıyı kullanır. `lib/admin/backend.ts` iki yönetim rotasının Convex bağlantı ayarlarını toplar.
- **Yönetim ekranı durumu:** `AdminGate` doğrulama tamamlanmadan alt ekranları görüntülemez. `useAdminResource` eski istekleri iptal eder. Profil ve checkout akışları, kullanıcı taslağını güncel varsayılanlarla birleştirir; effect içinde taslağı yeniden kopyalamaz.

## Mevcut sınırlar

- Katalog/yönetim listeleri 100, müşteri siparişleri 20, CMS listesi 50 kayıttır; daha büyük veri için sayfalama gerekir.
- Müşteri başına en fazla 100 adres ve sepet satırı başına en fazla 999 adet vardır.
- Örnek verileri sıfırlama, herhangi bir örnek veri tablosu 100 kaydı aşıyorsa silme başlamadan reddedilir. Daha büyük tablolar için toplu bakım gerekir.
- Bülten kaydı ve şifre değiştirme akışları henüz yoktur. Sipariş oluşturulduğunda `pending` durumunda kaydedilir.
- Yerel kod değişiklikleri Convex dağıtımına kendiliğinden uygulanmaz. Convex ve Next.js uygulamaları aynı ortam için dağıtılmalıdır.
