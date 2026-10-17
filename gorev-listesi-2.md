# Görev Listesi 2 — Düzeltmeler

Her satır tek bir iş. Sırayla uygulandı; mobil (390×844, dokunmatik emülasyon) ve masaüstü (1440×900) tarayıcı testleri geçti.

- [x] 1. **Beden rehberini kaldır, açıklama görsellerini ayır** — Beden rehberi butonu/modalı/alanı ve şema alanı kaldırıldı. Açıklama görselleri artık ürün galerisinden bağımsız yükleniyor; admin formunda ayrı yükleme alanı, önizleme, silme ve 12 görsel limiti var. Galeri görsel sayısı değişmeden PDP'de açıklama görseli gösterildi; silme sonrası sahipsiz dosya temizliği eklendi.
- [x] 2. **Teslimat bilgisini kompaktlaştır** — Teslimat kutusu 8×12 px padding ve 11 px yazıya indirildi; test değeriyle görsel olarak doğrulandı.
- [x] 3. **Kampanyalara ürün hedefleme ekle** — "Hedef: Tüm sepet / Kategori / Ürün" seçimi eklendi. Ürün hedefli yüzde indirimi (888 TL'de %15 = 133,20 TL), ürün hedefli X al Y öde (3 al 2 öde = 888 TL) ve ürün/kategori hedefli kargo bedava sepet + ödeme hattında doğrulandı.
- [x] 4. **Ürün kartı aksiyonlarını sadeleştir** — "Sepete Ekle" ve "Hemen Satın Al" kaldırıldı. Yalnızca görselin altından hover ile çıkan "Hızlı Bakış" kaldı; dokunmatik emülasyonda kalıcı görünür, klavye odağında da açılır. Hızlı Bakış modalı çalışıyor.
- [x] 5. **Son 24 saat satın alma bilgisini taşı** — Bilgi ürün adının hemen üstünde; "Son 24 saatte 4 kişi bu ürünü satın aldı" olarak mobil + masaüstünde doğrulandı.
- [x] 6. **Paylaş butonlarına ikon ekle** — WhatsApp, Telegram ve Bağlantıyı Kopyala butonlarının üçünde de SVG ikon doğrulandı.
- [x] 7. **Paket fırsatını kaldır** — `ozellik-listesi.md` 11. maddesi ve detay bölümü kaldırıldı; paket kodu (şema, motor, admin, PDP bileşeni) tamamen silindi. Admin kampanya türlerinde paket seçeneği yok; PDP'de paket rafı yok.

**Refactor:** kullanılmayan `variantId` kampanya satır alanı kaldırıldı, ürün hedefli ara toplam yardımcı fonksiyona çıkarıldı, açıklama görseli silindiğinde sahipsiz storage dosyaları temizleniyor, hızlı bakış butonuna klavye odağı görünürlüğü eklendi. `tsc` ve ESLint temiz (yalnızca checkout'taki 2 eski uyarı).
