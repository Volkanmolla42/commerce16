# Geliver kargo kurulumu

Geliver değişkenlerini Convex deployment ortamına ekleyin; token'ı Next.js istemcisine açmayın.

- `GELIVER_TOKEN`: Geliver panelinde oluşturulan API token.
- `GELIVER_SENDER_ADDRESS_ID`: Geliver'de kayıtlı, telefon ve posta kodu bulunan gönderici adresi.
- `GELIVER_SOURCE_IDENTIFIER`: mağazanın tam HTTPS adresi.
- `GELIVER_TEST_MODE=1`: simülasyon gönderileri. Canlı kargo açılmadan önce ayarları ve adres eşleşmelerini test edin; onaydan sonra `0` yapın.
- `GELIVER_PACKAGE_LENGTH_CM`, `GELIVER_PACKAGE_WIDTH_CM`, `GELIVER_PACKAGE_HEIGHT_CM`, `GELIVER_PACKAGE_WEIGHT_KG`: ürün ağırlığı/desisi katalogda tutulmadığı için gönderi teklifi alınırken kullanılan paket varsayılanları.

Ödemesi alınan sipariş için gönderi ve teklifler otomatik oluşturulur. Yönetici sipariş ayrıntısından en uygun veya en hızlı teklifi seçip etiketi satın alabilir. Takip numarası ve güvenli HTTPS etiket/takip bağlantıları Geliver yanıtında geldikçe siparişe yazılır. Bazı taşıyıcılarda takip kodu ilk teslim taramasından sonra oluşur.

API kurulumu başarısız veya sonucu belirsiz olursa yönetim ekranında hata ya da inceleme durumu görünür. Belirsiz etiket satın alımı otomatik tekrarlanmaz; aynı kargo ücreti iki kez oluşmasını önlemek için kayıt incelenmelidir.
