# Mimari

`app/(storefront)` vitrin ve müşteri akışlarını, `app/admin` yönetim ekranlarını içerir. Rota grubu URL'leri değiştirmez. Ortak tasarım öğeleri `components/ui` içinde kalır.

## Module ve interface

- **Katalog:** `lib/catalog` Convex dokümanlarını vitrin modeline dönüştürür. Kategori filtresi Convex index üzerinde uygulanır. Ürün ve kategori yazımları ilgili cache tag'lerini yeniler; CMS ve mağaza ayarı tag'leri ayrı kalır.
- **Sepet:** `components/cart/cart-store.ts` ürün/varyant kimliğini, adetleri ve tarayıcı depolamasını yönetir. `CartProvider` aynı interface'e `useSyncExternalStore` ile abone olur. Kalıcı JSON güvenilmeyen girdi olarak kontrol edilir; storage kapalıysa sepet bellekte çalışır.
- **Sipariş:** `convex/orders.ts` katalog fiyatını ve satış durumunu aynı transaction içinde doğrular, tutarı kuruş olarak hesaplar ve kalıcı snapshot oluşturur. İstemcinin fiyat/toplamı değişmişse sipariş reddedilir. Detayı yalnız oturum sahibi okuyabilir; misafir başarı ekranı oluşturma sonucunu gösterir.
- **Adres defteri:** `convex/addresses.ts` sahiplik ve varsayılan adres kurallarını yönetir. Checkout aynı `insertAddress` implementation kullanır.
- **Schema:** `convex/schema.ts` tek doküman kaynağıdır. Giriş ve dönüş validatorları `schema.doc()` üzerinden türetilir; vitrin ve yönetim görsel DTO'ları ihtiyaca göre daraltılır.
- **Yönetim girdileri:** `lib/admin/input.ts` HTTP girdilerini doğrular ve CMS HTML'i temizler. Create/update aynı parse interface kullanır. `lib/admin/backend.ts` iki yönetim rotasının Convex bağlantı ayarlarını toplar.
- **Yönetim state:** `AdminGate` doğrulama tamamlanmadan alt ekranları mount etmez. `useAdminResource` eski istekleri iptal eder. Profil/checkout, kullanıcı draft'ı ile güncel varsayılanları effect içinde kopyalamadan birleştirir.

## Kontroller

```sh
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p convex/tsconfig.json
npm test
npm run build
```

Testler kullanıcıların kullandığı interface üzerinden sepet, varyant, girdi doğrulama, checkout varsayılanları ve Convex transaction davranışını sınar. Convex testleri yerel `convex-test` ortamında çalışır; deployment'a yazmaz.

## Mevcut sınırlar

- Katalog/yönetim listeleri 100, müşteri siparişleri 20, CMS listesi 50 kayıttır; daha büyük veri için pagination gerekir.
- Müşteri başına en fazla 100 adres ve sepet satırı başına en fazla 999 adet vardır.
- Seed reset, herhangi fixture tablosu 100 kaydı aşıyorsa silme başlamadan reddedilir. Büyük veri temizliği ayrı, batch çalışan bakım gerektirir.
- Online ödeme, bülten kaydı ve şifre değiştirme entegrasyonu mevcut değildir. Checkout ödeme almadan `pending` sipariş oluşturur; kredi kartı bilgisi toplamaz.
- Yerel kod değişiklikleri Convex deployment'ına kendiliğinden uygulanmaz. Backend ve Next deployment'ları eşleşmelidir.
