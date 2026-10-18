# Özellik Listesi 

 S/M/L = görev büyüklüğü. Sıra, sert bağımlılıklara göre düzenlendi.

## Faz 1 — Vitrin hızlı kazanımlar

- [x] 1. **İndirim ve durum rozetleri** — varyant liste fiyatı (`compareAtPrice`), -%X, Yeni, Tükeniyor, Çok Satan; kart + detay, detayda eski fiyat üstü çizili. (M) — tamamlandı, mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 2. **Kartta ikinci görsel** — masaüstü hover'da ürünün ikinci açısı. (S) — tamamlandı, hover testi geçti (2026-10-17).
- [x] 3. **Hızlı bakış (Quick View)** — karttan galeri + fiyat + varyant + sepete ekle modalı. (M) — tamamlandı, mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 4. **Tahmini teslimat / kargo kesim saati** — "16:00'a kadar aynı gün" + iş günü tahmini; mağaza ayarından. (S) — tamamlandı, mobil + masaüstü ve saat dilimi testi geçti (2026-10-17).
- [x] 5. **Sosyal paylaşım** — WhatsApp, Telegram, bağlantı kopyala. (S) — tamamlandı, mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 6. **Son gezilen ürünler rafı** — mevcut localStorage takibini kullanır. (S) — tamamlandı, mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 7. **Popüler + son aramalar** — mevcut autosuggest'i genişletir; popüler için gerçek arama sayacı. (S/M) — tamamlandı, mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 8. **Ürün açıklaması + bağımsız görseller** — ürün formuna açıklama ve galeriden bağımsız açıklama görseli yükleme; PDP'de açıklama görselleri. (M) — tamamlandı; admin kaydet/temizle + mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 9. **WhatsApp / canlı destek butonu** — mağaza telefonundan tek tık. (S) — tamamlandı, mobil + masaüstü ve consent kapısı testi geçti (2026-10-17).

## Faz 2 — Sepet ve satış artırma

- [x] 10. **Otomatik kampanya motoru** — 3 al 2 öde, sepette %X, kategoriye kargo bedava; mevcut kupon ve kargo eşiğiyle aynı hesap hattında. (L) — tamamlandı; üç kural türü admin oluşturma, sepet + ödeme satırı, sipariş kaydı ve mobil + masaüstü tarayıcı testi geçti (2026-10-17).
- [x] 12. **Ürün Soru-Cevap** — soru sorma, admin yanıtı, PDP listesi. (M) — tamamlandı; giriş zorunlu soru formu (ad/e-posta hesaptan gelir, soru kullanıcıya bağlanır, rate limit) + admin e-posta uyarısı, moderasyon ekranı (yanıtla/yayınla, reddet, yayından kaldır, sil) ve PDP'de maskeli adla onaylı soru-cevap listesi; mobil + masaüstü tarayıcı testi geçti (2026-10-18).
- [x] 13. **Tek tıkla tekrar sipariş** — sipariş detayından güncel sepete aktarma. (S/M) — tamamlandı; güncel stok/satış doğrulama, sepete aktarma ve eklenemeyen ürünler modal özeti entegre edildi (2026-10-18).

## Faz 3 — Operasyon (yüksek öncelik)

- [x] 14. **Kurumsal fatura & adres ayrımı** — firma adı, vergi no/TCKN, fatura adresi; bireysel/kurumsal seçimi. (M) — tamamlandı; VKN (10 hane) / TCKN (11 hane) GİB checksum algoritması, ödeme sayfası bireysel/kurumsal ve bağımsız fatura adresi seçimi, sipariş kaydı, e-posta şablonu, müşteri hesabı, admin sipariş detayı ve CSV/Excel export entegrasyonu; mobil + masaüstü tarayıcı testi geçti (2026-10-18).
- [x] 15. **Excel içe/dışa aktar** — mevcut dışa aktarımı genişletme + ürün içe aktarma (varyant, fiyat, stok, SKU, barkod, liste fiyatı, görsel URL). (L) — tamamlandı; Excel/CSV içe ve dışa aktarım, barkod taşıma ve doğrulama geçti (2026-10-18).
- [ ] 16. **Kargo barkod / etiket PDF** — admin sipariş detayından barkodlu teslimat fişi. (M)


## Faz 4 — Altyapı

- [ ] 17. **Web push** — service worker + abonelik + admin gönderimi + terk edilen sepet tetiği. (L)
- [ ] 18. **E-fatura entegrasyonu** — Paraşüt/BizimHesap, e-Arşiv; kimlik bilgisi yoksa fail-closed. (L) — 14'e bağlı
- [ ] 19. **Sosyal giriş** — Google; Apple ayrı Apple Developer hesabı gerektirir. (L)
- [ ] 20. **Taksit tablosu** — gerçek PayTR entegrasyonu gelmeden anlamlı değil; şu anki ödeme akışı demo. (M) — beklemede

## Bağımlılıklar

- 11 → 10
- 17 → 14
- 20 → gerçek PayTR entegrasyonu
- 14 ve 15 bağımsız; yüksek öncelikli oldukları için öne çekilebilir.

## Notlar

- Taksit tablosu mevcut demo PayTR akışıyla yanıltıcı olur; gerçek PayTR gelene kadar yapılmamalı.
- Ürün formundaki `barcode` alanı `parseProductInput` tarafından taşınmıyor; Excel import görevinde ayrıca düzeltilecek.
- Proje kuralı gereği test dosyası yazılmayacak. Doğrulama: `npx tsc --noEmit` + `npx convex dev --once` + tarayıcı kontrolü.
- Her görev için zorunlu akış: plan → kod → bağımsız review → mobil (390×844) tarayıcı testi → masaüstü (1440×900) tarayıcı testi. Sorun yoksa madde `[x]` işaretlenir 
- Playwright tarayıcı testleri `http://localhost:3000` üzerinden yapılır; `127.0.0.1` bu dev ortamında hydrate olmuyor.

---

# Endüstri Standardı ve Shopify Referansı

## Genel mimari dersi

Shopify'da model net: **çekirdek veri ve para/stock kuralları sunucuda**, tema yalnızca gösterim yapar, eksik özellikler app + API ile tamamlanır. Son yıllarda otomatik indirim, bundle ve sepet dönüşümü gibi kurallar **Shopify Functions** (sunucuda çalışan WebAssembly modülleri) ile çözülüyor; tema bu kararları yeniden hesaplamıyor.

Bizim stack'te karşılığı: fiyat, stok, kampanya ve sipariş kuralları **Convex'te tek kaynak** olmalı; Next.js/React yalnızca gösterim ve önizleme yapmalı. Rozet, taksit, teslimat gibi türetilmiş bilgiler ayrı bayrak olarak saklanmamalı; kaynaktan hesaplanmalı. Dış sistemler (e-fatura, kargo, ödeme) **adapter + fail-closed config** arkasında durmalı.

## 1. İndirim ve durum rozetleri

- **Endüstri standardı:** Satış fiyatı ve liste fiyatı (compare-at) saklanır, indirim yüzdesi türetilir. "Yeni", "Çok Satan", "Tükeniyor" gibi etiketler oluşturma tarihi, stok ve satış hızından hesaplanır; ayrı bir "badge" tablosu tutulmaz.
- **Shopify'da:** Varyantta native `compare_at_price` vardır; tema "Sale" rozetini bundan üretir. Otomatik indirimler **Discount Functions** ile sunucuda hesaplanır. "New/Bestseller" gibi özel etiketler metafield/tag + tema veya app ile eklenir.
- **Bizim stack'te:** Varyantta `compareAtPrice`, üründe `createdAt` + `soldCount`; kurallar tek bir `lib/catalog/badges.ts` modülünde. Rozet bayrağı saklamıyoruz, her okumada türetiyoruz. `soldCount` yalnızca ödenmiş ve iptal edilmemiş siparişlerden beslenmeli.

## 2. Kartta ikinci görsel

- **Endüstri standardı:** Ürün medyası sıralı bir dizidir; ilk görsel LCP için önceliklidir, ikinci görsel yalnızca hover'da yüklenir/gösterilir. Mobilde genellikle ilk görsel kalır.
- **Shopify'da:** `product.media` dizisi; Dawn gibi temalar hover'da ikinci medyayı gösterir. Backend veya ek API yoktur, tamamen tema davranışıdır.
- **Bizim stack'te:** Mevcut `images` dizisinin ikinci elemanı; Next/Image ile lazy yükleme, CSS opacity/transform geçişi. Varyanta özel görsel varsa önce o kullanılmalı. Şema değişikliği gerekmez.

## 3. Hızlı bakış (Quick View)

- **Endüstri standardı:** Liste sayfasından çıkmadan minimal ürün detayı: galeri, fiyat, varyant seçimi, sepete ekle. Tam ürün sayfası canonical kalır; modal derin bağlantı vermez.
- **Shopify'da:** Dawn'da karttan "hızlı ekle" ve varyant modalı vardır; tam quick view genellikle tema özelliği veya app'tir. App'ler ürün verisini Section Rendering API / product JSON ile çeker.
- **Bizim stack'te:** Karttaki mevcut ürün verisiyle açılan client modal; eksik alanlar için tek Convex query. Sepete ekleme mevcut cart store üzerinden. Ayrı bir ürün kopyası/state tutulmamalı.

## 4. Tahmini teslimat ve kargo kesim saati

- **Endüstri standardı:** Kesim saati + iş günü + tatil takvimi + taşıyıcı transit süresi + saat dilimi birlikte hesaplanır; belirsizse tahmin gösterilmez. Hesap sunucuda yapılır, istemci yalnızca sonucu gösterir.
- **Shopify'da:** Native local delivery/pickup seçenekleri vardır; "tahmini teslimat" genellikle app veya tema metafield'ı ile eklenir. Taşıyıcı entegrasyonu varsa gerçek transit süresi kullanılır.
- **Bizim stack'te:** `storeSettings` içine kesim saati + iş günü sayısı; `Europe/Istanbul` saat dilimiyle hesaplayan saf bir yardımcı. PDP ve sepette göster; ayar boşsa uydurma metin gösterme. Resmî tatil tablosu sonraki adım.

## 5. Sosyal paylaşım

- **Endüstri standardı:** Önce Web Share API denenir; desteklenmiyorsa WhatsApp/Telegram/X için URL şemaları ve panoya kopyalama fallback'i kullanılır. Paylaşım kartı için Open Graph/Twitter meta etiketleri şarttır.
- **Shopify'da:** Dawn temasında native paylaşım butonu vardır; `navigator.share` + fallback linkler kullanır. Backend gerekmez.
- **Bizim stack'te:** PDP'de client bileşen; WhatsApp/Telegram URL'leri + kopyala. Canonical ürün URL'i ve mevcut OG metadata'sı kullanılır. Paylaşım sayısı gibi bir metrik ilk sürümde gerekmez.

## 6. Son gezilen ürünler

- **Endüstri standardı:** Tarayıcıda ürün slug/id + zaman damgası tutulur (localStorage/cookie); sunucudan güncel ürün verisi çekilir. Liste boyutu sınırlıdır, fiyat/stok kopyası saklanmaz.
- **Shopify'da:** Core'da "recently viewed" yoktur; temalar ve app'ler localStorage/cookie ile yapar. Recommendation API daha çok "benzer/ilgili" içindir.
- **Bizim stack'te:** Mevcut localStorage takibi (20 slug) kullanılır; yeni bir `getProductsBySlugs` query'si ile güncel fiyat/stok alınır, son 5 ürün yatay raf olarak gösterilir. Stokta olmayanlar filtrelenir.

## 7. Son aramalar

- **Endüstri standardı:** En az 2 karakter + debounce ile öneri; son aramalar tarayıcıda tutulur.
- **Shopify'da:** **Search & Discovery** app'i ve **Predictive Search API** (`/search/suggest.json`) önerileri sağlar. Son aramalar tema tarafında localStorage ile tutulur.
- **Bizim stack'te:** Mevcut autosuggest korunur. Son aramalar localStorage'da tutulur.

## 8. Ürün açıklaması ve bağımsız görseller

- **Endüstri standardı:** Açıklama zengin metin + medya referanslarıdır; ham HTML güvenilmez, sanitize edilir. Açıklama görselleri ürün galerisinden ayrı yönetilir.
- **Shopify'da:** Metafields (rich text, file reference) kullanılır; açıklama görselleri tema tarafında galeriden bağımsız gösterilir. Core'da hazır beden rehberi yoktur.
- **Bizim stack'te:** Ürün açıklaması metni + Convex Storage'a yüklenen bağımsız açıklama görselleri; galeri görselleri ayrı tutulur. Beden rehberi kaldırıldı.

## 9. WhatsApp ve canlı destek

- **Endüstri standardı:** Sabit konumlu destek widget'ı; WhatsApp için `wa.me` click-to-chat; canlı chat için sağlayıcı SDK'sı (Intercom, Gorgias vb.) genellikle consent sonrası yüklenir. Mobilde uygulamaya deep link.
- **Shopify'da:** **Shopify Inbox** native canlı chat app'idir; WhatsApp genellikle app veya doğrudan link ile eklenir.
- **Bizim stack'te:** Mağaza telefonundan üretilen WhatsApp linki + sabit buton; üçüncü parti SDK yok. İleride canlı destek sağlayıcısı eklenirse consent kapısı arkasında yüklenmeli.

## 10. Otomatik kampanya motoru

- **Endüstri standardı:** Kural motoru koşul (sepet satırı, kategori, adet, müşteri etiketi, pazar) + aksiyon (ürün/order/kargo indirimi) tanımlar. Hesap sunucuda, kuruş cinsinden ve deterministik yuvarlamayla yapılır; indirimlerin birleşme sırası açıkça tanımlanır ve audit log tutulur.
- **Shopify'da:** **Discount Functions** sunucuda çalışır; product/order/shipping indirim sınıfları ve kombinasyon kuralları vardır. Bundle gibi sepet değişiklikleri **Cart Transform Function** ile yapılır. Tema indirimi yeniden hesaplamaz.
- **Bizim stack'te:** `promotionRules` tablosu + saf değerlendirici; aynı değerlendirici hem `cart.quote` query'sinde hem `createOrder` içinde çalışır. Kuponla birleşme kuralı (üst üste binme / sıralama) baştan tanımlanmalı. İndirim kuruş üzerinden hesaplanmalı.

## 12. Ürün Soru-Cevap

- **Endüstri standardı:** Soru tablosu; durumlar (beklemede/onaylı/reddedildi); rate limit ve spam kontrolü; admin moderasyonu; onaylı soruların PDP'de gösterimi; isteğe bağlı FAQPage schema.
- **Shopify'da:** Native Q&A yoktur; AC Q&A, Inquiris, Growave gibi app'ler veya statik FAQ için metafields kullanılır. App'ler moderasyon ve AI yanıtı ekleyebilir.
- **Bizim stack'te:** `productQuestions` tablosu + giriş zorunlu `ask` mutation (rate limit) + admin onay/yanıt ekranı. Ad ve e-posta hesaptan okunur, soru `userId`'ye bağlanır; yalnızca onaylılar gösterilir; admin'e e-posta bildirimi mevcut mail altyapısından gönderilir.

## 13. Tek tıkla tekrar sipariş

- **Endüstri standardı:** Önceki sipariş satırları güncel fiyat ve stokla sepete kopyalanır; mevcut olmayan ürünler atlanır ve kullanıcıya özet gösterilir. Eski indirim/kupon otomatik taşınmaz; güncel kampanyalar yeniden uygulanır.
- **Shopify'da:** Customer accounts sipariş geçmişini gösterir; "buy again" genellikle tema özelliği veya app'tir, evrensel native bir buton yoktur.
- **Bizim stack'te:** Sipariş detayında "Tekrar sipariş ver" → mevcut cart store'a satır satır ekleme. Ürün/varyant silinmişse atla, kullanıcıya "X ürün sepete eklenemedi" özeti göster. Sunucu ödeme adımında fiyatı yeniden doğrular.

## 14. Kurumsal fatura ve adres ayrımı

- **Endüstri standardı:** Fatura adresi ile teslimat adresi ayrıdır; fatura tipi (bireysel/kurumsal), firma adı, VKN/TCKN, vergi dairesi alanları ülke kurallarına göre doğrulanır. Fatura PDF'i ve e-fatura entegrasyonu bu veriyi kullanır.
- **Shopify'da:** Fatura/teslimat adresi native ayrıdır. B2B company profiles (Plus) Tax ID taşır; Türkiye'ye özel VKN/TCKN alanları genellikle checkout UI extension veya app ile eklenir.
- **Bizim stack'te:** Siparişe `billingType`, `companyName`, `taxNumber`, `taxOffice`, `billingAddress` alanları; checkout + hesap + admin ekranları. VKN (10 hane) / TCKN (11 hane) checksum doğrulaması. E-fatura bu alanları tüketir; alanlar eksikse e-fatura gönderilmez.

## 15. Excel içe / dışa aktar

- **Endüstri standardı:** İçe aktarma bir pipeline'dır: yükle → kolon eşle → doğrula → önizle/dry-run → idempotent upsert → hata raporu. Büyük dosyalar arka planda işlenir; görseller URL'den indirilirken SSRF ve boyut koruması gerekir. Dışa aktarma şeması kararlı ve versiyonlanabilir olmalı.
- **Shopify'da:** Ürünler ve varyantlar için native CSV import/export vardır; inventory ayrı CSV ile yönetilir. Gelişmiş senaryolarda Matrixify gibi app'ler kullanılır.
- **Bizim stack'te:** xlsx/csv parser + staging/job tablosu; ürün anahtarı slug, varyant anahtarı SKU. Görsel URL'leri indirilirken allowlist/boyut kontrolü; hatalı satırlar için indirilebilir rapor. Mevcut dışa aktarma `compareAtPrice`, barkod, seçenekler ve görselleri kapsayacak şekilde genişletilmeli.

## 16. Kargo barkod / etiket PDF

- **Endüstri standardı:** Sunucuda A6/10x15 etiket PDF'i üretilir; Code128/GS1-128 barkod, gönderici/alıcı, sipariş no ve takip numarası basılır. Termal yazıcı için print CSS; tekrar basım idempotent olmalı. Taşıyıcı API'si varsa gerçek label alınır, yoksa operasyonel etiket üretilir.
- **Shopify'da:** **Shopify Shipping** ile kargo etiketi satın alınır ve admin'den PDF/termal olarak basılır. Özel etiketler için app'ler kullanılır.
- **Bizim stack'te:** Admin yetkili endpoint + sunucu tarafı PDF (`pdf-lib` gibi) + barkod (`bwip-js` gibi). Veri sipariş ve mağaza ayarlarından; takip numarası yoksa sipariş numarası barkodu. İlk sürümde taşıyıcı entegrasyonu şart değil.

## 17. E-fatura entegrasyonu

- **Endüstri standardı:** Sipariş ödendi olayı → e-fatura sağlayıcı API'si → fatura durumu. İdempotency, retry, hata kaydı ve fatura UUID/URL saklama gerekir. Kimlik bilgileri yoksa işlem durur (fail-closed); mutabakat için webhook veya polling kullanılır.
- **Shopify'da:** Türkiye'ye özel native e-Arşiv yoktur; Paraşüt/BizimHesap gibi yerel sağlayıcılar app/entegrasyon ile bağlanır.
- **Bizim stack'te:** Convex action, sipariş "paid" olduğunda sağlayıcı adapter'ını çağırır; `invoices` tablosunda durum/URL tutulur. Retry ve admin durum ekranı. Kimlik bilgisi yoksa fatura kesilmez ve sipariş işaretlenir. 14. maddeden sonra yapılmalı.

## 18. Sosyal giriş

- **Endüstri standardı:** OAuth 2.0/OIDC; doğrulanmış e-posta ile hesap eşleme; state/nonce/PKCE; oturum çerezi/JWT. Apple, gizli e-posta relay'i ve ayrı developer hesabı gerektirir.
- **Shopify'da:** Yeni customer accounts Google, Facebook ve Apple ile sosyal girişi native destekler; klasik hesaplar e-posta/şifredir.
- **Bizim stack'te:** Convex Auth'a Google OAuth provider eklenir; `auth.config.ts` ve yönlendirme URL'leri güncellenir. Mevcut e-posta/şifre korunur. Apple sonraki adım; Google ilk sürüm için yeterli.

## 19. Web push

- **Endüstri standardı:** Service worker + Push API + VAPID anahtarları; abonelik endpoint'leri sunucuda saklanır. İzin, kullanıcı niyetinden sonra istenir; bildirim tıklaması yönlendirilir; TTL ve segmentasyon yönetilir.
- **Shopify'da:** Native web push yoktur; PushAlert, Firepush, WonderPush gibi app'ler service worker ve terk edilen sepet tetikleyicileriyle çalışır.
- **Bizim stack'te:** `public/sw.js`, VAPID env anahtarları, `pushSubscriptions` tablosu ve `web-push` paketi. Admin kampanya gönderimi; mevcut `abandonedCartRecovery` akışına push tetiği. İzin UI'ı kullanıcı etkileşiminden sonra gösterilmeli.

## 20. Taksit tablosu

- **Endüstri standardı:** Taksit oranları ödeme sağlayıcısından gelir: kart ailesi/BIN + tutar + taksit sayısı → aylık ödeme, toplam, komisyon. Nihai oran ödeme adımında doğrulanır; uydurma oran gösterilmez. Tablo tutar/kart bazında cache'lenebilir.
- **Shopify'da:** Shopify Payments'ın Shop Pay Installments ürünü yalnızca desteklenen pazarlarda vardır; Türkiye'de Shopify Payments yoktur. Yerel sağlayıcılar (PayTR, iyzico, Param, Craftgate) taksit desteği sunar.
- **Bizim stack'te:** Gerçek PayTR entegrasyonu gelene kadar taksit tablosu yapılmamalı; mevcut ödeme akışı demo. Entegrasyondan sonra oranlar sağlayıcıdan/mağaza ayarından gelir; PDP'de "taksit seçenekleri ödeme adımında" gösterilir.

---

## Kaynaklar

- Shopify Discount Functions: https://instasupport.io/guides/shopify-discount-function-deep-dive
- Shopify Cart Transform API: https://shopify.dev/docs/api/functions/latest/cart-transform
- Shopify Functions ve bundle mimarisi: https://flux.agency/insights/shopify-functions-discounts-promotions
- Shopify Predictive Search API: https://shopify.dev/docs/api/ajax/reference/predictive-search
- Shopify Search & Discovery: https://apps.shopify.com/search-and-discovery
- Shopify metafields ve size chart: https://help.shopify.com/en/manual/custom-data/metafields/pop-up-tutorial
- Shopify metaobjects: https://help.shopify.com/en/manual/custom-data/metaobjects
- Shopify social sign-in: https://help.shopify.com/en/manual/customers/customer-accounts/sign-in-options/social-sign-in
- Shopify shipping labels: https://help.shopify.com/en/manual/fulfillment/fulfilling-orders/shipping-labels/managing-labels/printing-shipping-documents
- Shopify Inbox: https://apps.shopify.com/inbox
- Shopify Customer Privacy API: https://shopify.dev/docs/api/customer-privacy
- Shopify CSV import/export: https://help.shopify.com/en/manual/products/import-export/using-csv
- Shopify B2B companies ve Tax ID: https://help.shopify.com/en/manual/b2b/companies-and-customers/creating-companies
- Shopify web push app örnekleri: https://apps.shopify.com/pushalert-web-push-notifications
- Shopify product Q&A app örneği: https://apps.shopify.com/product-questions-and-answers-by-appifycommerce
- Türkiye'de Shopify ödeme sağlayıcıları: https://nodusworks.com/en/blog/how-to-connect-shopify-paytr-shopify-turkey-payment-methods
- Shopify Shop Pay Installments: https://www.shopify.com/shop-pay-installments
