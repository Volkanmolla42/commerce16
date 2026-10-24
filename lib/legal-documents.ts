import { escapeHtml } from "./html";

interface SellerInfo {
  storeName: string;
  legalName: string;
  address: string;
  taxOffice: string;
  taxNumber: string;
  mersis: string;
  email: string;
  phone: string;
}

export const LEGAL_DOCUMENT_TITLES = {
  distanceSalesAgreement: "Mesafeli Satış Sözleşmesi",
  preInformationForm: "Ön Bilgilendirme Formu",
  refundPolicy: "İade ve Cayma Hakkı Politikası",
  cookiePolicy: "Çerez Politikası",
} as const;

/** Kullanım koşulları metni değiştiğinde bu sürümü güncelleyin. */
export const TERMS_VERSION = "2026-10-24";

export interface LegalDocument {
  title: string;
  slug: string;
  body: string;
  version: string;
  ready: boolean;
}

interface LegalDocuments {
  distanceSalesAgreement: LegalDocument;
  preInformationForm: LegalDocument;
  refundPolicy: LegalDocument;
  cookiePolicy: LegalDocument;
}

function sellerRows(seller: SellerInfo) {
  const rows = [
    `Unvan: ${escapeHtml(seller.legalName.trim() || seller.storeName.trim())}`,
    seller.storeName.trim() && seller.storeName.trim() !== seller.legalName.trim()
      ? `Marka: ${escapeHtml(seller.storeName.trim())}`
      : "",
    `Adres: ${escapeHtml(seller.address.trim())}`,
    seller.taxOffice.trim() ? `Vergi Dairesi: ${escapeHtml(seller.taxOffice.trim())}` : "",
    seller.taxNumber.trim() ? `Vergi Kimlik No / TCKN: ${escapeHtml(seller.taxNumber.trim())}` : "",
    seller.mersis.trim() ? `MERSİS: ${escapeHtml(seller.mersis.trim())}` : "",
    `E-posta: ${escapeHtml(seller.email.trim())}`,
    `Telefon: ${escapeHtml(seller.phone.trim())}`,
  ];
  return rows.filter(Boolean).join("<br />\n  ");
}

function versionOf(title: string, body: string) {
  const source = `${title}\n${body}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function documentOf(title: string, slug: string, body: string, ready: boolean): LegalDocument {
  return { title, slug, body, version: versionOf(title, body), ready };
}

/**
 * Satıcı kimliği mağaza yapılandırmasından gelir; eksikse sözleşme hazırlanmamış sayılır
 * ve ödeme ekranı belge onayını açmaz.
 */
export function getLegalDocuments(seller: SellerInfo): LegalDocuments {
  const ready = [
    seller.legalName,
    seller.address,
    seller.email,
    seller.phone,
    seller.taxOffice,
    seller.taxNumber,
  ].every((value) => value.trim().length > 0);

  return {
    distanceSalesAgreement: documentOf(
      LEGAL_DOCUMENT_TITLES.distanceSalesAgreement,
      "mesafeli-satis-sozlesmesi",
      `
<h2>Madde 1 - Taraflar</h2>
<p>
  <strong>1.1. Satıcı:</strong><br />
  ${sellerRows(seller)}
</p>
<p>
  <strong>1.2. Alıcı:</strong><br />
  Web sitesi üzerinden sipariş veren, sipariş formunda adı, soyadı, teslimat adresi, e-posta adresi ve telefon numarası yer alan gerçek veya tüzel kişidir.
</p>

<h2>Madde 2 - Sözleşmenin Konusu</h2>
<p>
  İşbu sözleşmenin konusu, Alıcı'nın Satıcı'ya ait web sitesinden elektronik ortamda siparişini yaptığı,
  aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı
  Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların
  hak ve yükümlülüklerinin saptanmasıdır.
</p>

<h2>Madde 3 - Siparişe Konu Ürün, Bedel ve Ödeme Koşulları</h2>
<p>
  Ürün veya ürünlerin cinsi, miktarı, modeli, vergiler dâhil satış bedeli, ödeme yöntemi ve kargo masrafları
  sipariş öncesi onaylanan sipariş özetinde ve Alıcı'ya iletilen sipariş teyit e-postasında detaylı şekilde belirtilmiştir.
  Ödemeler havale/EFT veya kapıda ödeme yöntemleriyle gerçekleştirilir; kredi kartı bilgileri sitemizde toplanmaz.
</p>

<h2>Madde 4 - Teslimat Şartları</h2>
<p>
  Sözleşme konusu ürün veya ürünler, yasal 30 günlük süreyi aşmamak koşulu ile her bir ürün için Alıcı'nın
  yerleşim yerinin uzaklığına bağlı olarak taahhüt edilen süre zarfında Alıcı veya gösterdiği adresteki kişi/kuruluşa
  anlaşmalı kargo firması aracılığıyla teslim edilir.
</p>

<h2>Madde 5 - Cayma Hakkı</h2>
<p>
  Alıcı; mal satışına ilişkin mesafeli sözleşmelerde, ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa
  teslim tarihinden itibaren 14 (on dört) gün içerisinde hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir
  gerekçe göstermeksizin sözleşmeden cayma hakkına sahiptir. Cayma hakkının kullanımına ilişkin
  bildirim, bu süre içinde Satıcı'nın iletişim kanallarına yazılı olarak veya kalıcı veri saklayıcısı ile yöneltilmelidir.
</p>

<h2>Madde 6 - Cayma Hakkı Kullanılamayacak Haller</h2>
<p>
  Alıcı'nın özel istekleri veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan, çabuk bozulma tehlikesi olan
  veya son kullanma tarihi geçme ihtimali olan mallar ile tesliminden sonra ambalajı açılmış hijyenik açıdan uygun
  olmayan mallar ve mevzuatın ilgili maddelerinde belirtilen diğer istisnai ürünlerde cayma hakkı kullanılamaz.
</p>

<h2>Madde 7 - Uyuşmazlıkların Çözümü</h2>
<p>
  İşbu Sözleşme'den doğabilecek uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dâhilinde
  Alıcı'nın yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.
</p>
      `.trim(),
      ready,
    ),
    preInformationForm: documentOf(
      LEGAL_DOCUMENT_TITLES.preInformationForm,
      "on-bilgilendirme-formu",
      `
<h2>1. Konu ve Amaç</h2>
<p>
  İşbu Ön Bilgilendirme Formu ("Form"), 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
  Yönetmeliği hükümleri uyarınca, Alıcı'nın elektronik ortamda siparişini vermeden önce Satıcı, siparişe konu
  mal veya hizmetin temel nitelikleri, satış fiyatı, ödeme şekli, teslimat koşulları ve cayma hakkı hakkında
  bilgilendirilmesini amaçlamaktadır.
</p>

<h2>2. Satıcı Bilgileri</h2>
<p>
  ${sellerRows(seller)}
</p>

<h2>3. Siparişe Konu Mal veya Hizmetin Temel Nitelikleri ve Fiyatı</h2>
<p>
  Siparişe konu ürün veya ürünlerin cinsi, türü, miktarı, rengi, vergiler dâhil satış bedeli ve kargo ücreti
  ödeme işlemi tamamlanmadan önce sipariş özetinde ve Alıcı'ya iletilen bilgilendirme e-postasında açıkça gösterilmektedir.
</p>

<h2>4. Ödeme ve Teslimat Koşulları</h2>
<p>
  Sipariş bedeli, havale/EFT veya kapıda ödeme yöntemleriyle tahsil edilir. Kredi kartı bilgileri
  sitemizde toplanmaz ve saklanmaz.
  Siparişler, sipariş onayından itibaren yasal 30 günlük süreyi aşmamak kaydıyla anlaşmalı kargo firmaları aracılığıyla
  Alıcı'nın belirttiği teslimat adresine güvenle teslim edilir.
</p>

<h2>5. Cayma Hakkı</h2>
<p>
  Alıcı, hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin, malın teslim alındığı
  tarihten itibaren 14 (on dört) gün içerisinde cayma hakkını kullanabilir. Cayma bildirimi e-posta veya yazılı
  olarak (kalıcı veri saklayıcısı) yapılmalıdır. Alıcı, cayma bildirimini takip eden 10 (on) gün içinde ürünü
  Satıcı'nın bildireceği adrese iade eder. Standart iade kargosu Satıcı tarafından karşılanır; Alıcı'nın talebiyle
  daha yüksek bedelli bir kargo hizmeti seçilirse aradaki fark Alıcıya aittir. Ürünün olağan inceleme dışında
  kullanılmamış olması gerekir.
</p>

<h2>6. Cayma Hakkının Kullanılamayacağı Haller</h2>
<p>
  Mevzuat gereği; Alıcı'nın istekleri veya kişisel ihtiyaçları doğrultusunda özel olarak hazırlanan ürünler,
  çabuk bozulabilen ürünler, tesliminden sonra ambalaj, bant, mühür, paket gibi koruyucu unsurları açılmış olan mallardan;
  iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde cayma hakkı kullanılamaz. Dijital içeriklerde cayma hakkı,
  ancak Alıcı'nın önceden açık onayı ve cayma hakkını kaybedeceğine dair bilgilendirilmesi halinde kullanılamaz.
</p>

<h2>7. Uyuşmazlık Çözümü ve Şikâyet Başvuruları</h2>
<p>
  İşbu formun uygulanmasından doğabilecek uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl belirlenen parasal
  sınırlar dâhilinde Alıcı'nın mal veya hizmeti satın aldığı ya da ikametgâhının bulunduğu yerdeki Tüketici Hakem Heyetleri
  veya Tüketici Mahkemeleri yetkilidir.
</p>
      `.trim(),
      ready,
    ),
    refundPolicy: documentOf(
      LEGAL_DOCUMENT_TITLES.refundPolicy,
      "iade-ve-cayma-hakki",
      `
<h2>1. Kapsam ve Satıcı Bilgileri</h2>
<p>
  Bu politika, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği
  uyarınca cayma hakkı, iade ve geri ödeme süreçlerini açıklar. Satıcı bilgileri aşağıdadır:
</p>
<p>
  ${sellerRows(seller)}
</p>

<h2>2. Cayma Hakkı</h2>
<p>
  Alıcı, ürünün kendisine veya gösterdiği adresteki kişiye teslim edildiği tarihten itibaren
  14 (on dört) gün içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkına sahiptir.
  Cayma hakkı, ürünün teslim edildiği gün başlar.
</p>

<h2>3. Cayma Hakkı Nasıl Kullanılır?</h2>
<p>
  Cayma bildirimini süre içinde Satıcı'ya e-posta veya yazılı olarak (kalıcı veri saklayıcısı) iletebilirsiniz.
  Bildirimde sipariş numaranızı ve iade etmek istediğiniz ürünleri belirtmeniz yeterlidir.
  Cayma bildirimini takip eden 10 (on) gün içinde ürünü Satıcı'nın bildireceği iade adresine göndermeniz gerekir.
</p>
<p>
  İade adresi ve süreç bilgisi için ${escapeHtml(seller.email.trim() || "mağaza iletişim kanalları")} adresinden
  veya ${escapeHtml(seller.phone.trim() || "mağaza telefon numarası")} üzerinden bize ulaşabilirsiniz.
</p>

<h2>4. İade Koşulları ve Kargo</h2>
<p>
  Ürünün olağan inceleme dışında kullanılmamış ve hasar görmemiş olması gerekir.
  Ürünü, varsa etiket, garanti belgesi ve aksesuarlarıyla birlikte gönderiniz. Standart iade kargosu
  Satıcı tarafından karşılanır; Alıcı'nın talebiyle daha yüksek bedelli bir kargo hizmeti seçilirse
  aradaki fark Alıcı tarafından karşılanır.
</p>

<h2>5. Cayma Hakkının İstisnaları</h2>
<p>Cayma hakkı, mevzuatın izin verdiği aşağıdaki hallerde kullanılamaz:</p>
<ul>
  <li>Alıcı'nın istekleri veya kişisel ihtiyaçları doğrultusunda özel olarak üretilen, kişiselleştirilen ürünler</li>
  <li>Tesliminden sonra koruyucu ambalajı, mührü veya bandı açılmış hijyenik ürünler</li>
  <li>Çabuk bozulabilen veya son kullanma tarihi geçebilecek ürünler</li>
  <li>Mevzuatta açıkça istisna tutulan diğer ürünler</li>
</ul>

<h2>6. Geri Ödeme</h2>
<p>
  Cayma bildirimi Satıcı'ya ulaştığında, ürünün iadesi beklenmeksizin en geç 14 (on dört) gün içinde
  ödeme aracınıza uygun şekilde geri ödeme yapılır. Geri ödeme nedeniyle Alıcı'dan ek komisyon veya
  masraf alınmaz. Havale/EFT ile yapılan iadelerde tutarın hesaba yansıma süresi bankanıza bağlıdır.
</p>

<h2>7. Ayıplı Ürün ve Yasal Haklar</h2>
<p>
  Bu politika, ayıplı mal nedeniyle 6502 sayılı Kanun'un 8. ila 12. maddelerinden doğan yasal haklarınızı
  sınırlamaz. Ayıplı olduğunu düşündüğünüz ürünler için 14 günlük cayma süresinden bağımsız olarak
  bizimle iletişime geçebilirsiniz.
</p>

<h2>8. Uyuşmazlık Çözümü</h2>
<p>
  Uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dâhilinde Alıcı'nın yerleşim yerindeki
  veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.
</p>
      `.trim(),
      ready,
    ),
    cookiePolicy: documentOf(
      LEGAL_DOCUMENT_TITLES.cookiePolicy,
      "cerez-politikasi",
      `
<h2>1. Veri Sorumlusu</h2>
<p>
  Bu Çerez Politikası, web sitemizde kullanılan çerezler ve benzeri tarayıcı depolama teknolojileri hakkında
  sizi bilgilendirmek için hazırlanmıştır. Veri sorumlusu aşağıdadır:
</p>
<p>
  ${sellerRows(seller)}
</p>

<h2>2. Çerez Nedir?</h2>
<p>
  Çerezler, ziyaret ettiğiniz web sitelerinin tarayıcınıza yerleştirdiği küçük veri dosyalarıdır.
  Benzer şekilde localStorage ve sessionStorage, tarayıcıda bilgi saklamak için kullanılan teknolojilerdir.
  Bu politika kapsamında her ikisi birlikte ele alınmıştır.
</p>

<h2>3. Çerez Kategorileri</h2>
<ul>
  <li>
    <strong>Zorunlu çerezler:</strong> Sepetin, favorilerin ve oturum güvenliğinin çalışması için gereklidir.
    Bu veriler olmadan mağaza işlevlerini yerine getiremez; bu nedenle kapatılamaz.
  </li>
  <li>
    <strong>İşlevsel çerezler:</strong> Son görüntülenen ürünleri ve son aramaları hatırlayarak kişiselleştirme
    sağlar. Yalnızca açık onayınızla etkinleşir; onay geri alındığında bu kayıtlar silinir.
  </li>
  <li>
    <strong>Analitik çerezler:</strong> Mağazanın nasıl kullanıldığını takma adlı ziyaretçi ve oturum
    kimlikleriyle ölçmemizi sağlar. Yalnızca açık onayınızla etkinleşir. Bu kimlikler rastgele üretilir;
    ad, e-posta veya telefon gibi doğrudan kimlik bilgileriyle eşleştirilmez.
  </li>
  <li>
    <strong>Pazarlama çerezleri:</strong> Reklam ölçümü için Meta Pixel'i çalıştırır. Yalnızca açık onayınızla
    etkinleşir; onay vermediğinizde Facebook sunucularına istek gönderilmez.
  </li>
</ul>

<h2>4. Kullanılan Anahtarlar ve Saklama Süreleri</h2>
<ul>
  <li><strong>commerce_cart_v2</strong> (localStorage): Sepet içeriğini tarayıcınızda saklar. Siz silene kadar tutulur.</li>
  <li><strong>commerce16:favorites</strong> (localStorage): Favori ürünleri saklar. Siz silene kadar tutulur.</li>
  <li><strong>commerce_quick_buy_v2</strong> (sessionStorage): Hızlı satın alma oturumunu saklar; sekme kapanınca silinir.</li>
  <li><strong>commerce_cart_recovery_v1</strong> (localStorage): Terk edilmiş sepet kurtarma özelliği kullanıldığında oluşturulan anonim oturum anahtarını tutar; sunucudaki sepet kaydı 48 saat sonra silinir.</li>
  <li><strong>commerce-cookie-consent-v1</strong> (localStorage): Çerez tercihlerinizi saklar. Politika sürümü değiştiğinde veya 180 gün geçtiğinde yeniden onay istenir.</li>
  <li><strong>commerce_recent_products_v1</strong> (localStorage): Yalnızca işlevsel onay verildiğinde son görüntülediğiniz ürünleri öneri amacıyla saklar. Onay geri alındığında silinir.</li>
  <li><strong>commerce_recent_searches_v1</strong> (localStorage): Yalnızca işlevsel onay verildiğinde son aramalarınızı arama kutusunda göstermek için saklar. Onay geri alındığında silinir.</li>
  <li><strong>commerce_analytics_consent</strong> (httpOnly çerez): Analitik onayınızı sunucuda doğrular. 180 gün geçerlidir.</li>
  <li><strong>commerce_analytics_visitor_v1</strong> ve <strong>commerce_analytics_first_touch_v1</strong> (localStorage): Analitik onayı sonrası takma adlı ziyaretçi kimliği ve ilk temas kaynağını tutar; onay geri alındığında silinir.</li>
  <li><strong>commerce_analytics_session_v1</strong> (sessionStorage): 30 dakikalık hareketsizlik sonrası yenilenen takma adlı oturum kimliği tutar; sekme kapanınca silinir.</li>
  <li><strong>meta-purchase:&lt;siparişNo&gt;</strong> (localStorage): Aynı sipariş için Meta satın alma olayının iki kez gönderilmesini önler. Yalnızca pazarlama onayı verildiğinde yazılır.</li>
  <li><strong>_fbp ve _fbc</strong> (Meta çerezleri): Yalnızca pazarlama onayı verildiğinde Meta Pixel tarafından yerleştirilir. Süreleri Meta tarafından belirlenir ve genellikle 90 gündür.</li>
  <li><strong>Oturum çerezleri:</strong> Giriş yaptığınızda kimlik doğrulama sağlayıcımız tarafından güvenli oturum için yerleştirilir; çıkış yaptığınızda veya oturum süresi dolduğunda geçersiz olur.</li>
</ul>

<h2>5. Tercihlerinizi Yönetme</h2>
<p>
  Site alt bilgisindeki <strong>Çerez tercihleri</strong> bağlantısından analitik ve pazarlama izinlerinizi
  dilediğiniz zaman değiştirebilir veya geri alabilirsiniz. Ayrıca tarayıcınızın gizlilik ayarlarından
  çerezleri ve yerel depolamayı silebilir ya da engelleyebilirsiniz. Zorunlu çerezlerin engellenmesi
  halinde sepet ve oturum işlevleri çalışmayabilir.
</p>

<h2>6. Üçüncü Taraflar</h2>
<p>
  Altyapı ve veritabanı hizmeti için Convex, e-posta gönderimi için Resend ve yalnızca onay verdiğinizde
  Meta Pixel kullanılmaktadır. Ödeme havale/EFT veya kapıda ödeme ile yapılır; kart bilgileri toplanmaz.
  Analitik verileri üçüncü taraf bir reklam ağıyla paylaşılmaz.
</p>

<h2>7. İletişim</h2>
<p>
  Çerezler ve kişisel verilerinizle ilgili talepleriniz için ${escapeHtml(seller.email.trim() || "mağaza iletişim kanalları")}
  adresinden bize ulaşabilirsiniz. Ayrıntılı bilgi için <a href="/gizlilik-politikasi">Gizlilik Politikası</a> sayfamızı inceleyebilirsiniz.
</p>
      `.trim(),
      ready,
    ),
  };
}
