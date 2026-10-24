import { routes } from "@/lib/storefront-routes";
import Link from "next/link";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo, isLegalIdentityConfigured, storeConfig } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: "Gizlilik Politikası",
  description: `${storeConfig.name} gizlilik ve kişisel verilerin korunması politikası.`,
  path: routes.privacyPolicy,
  ...(isLegalIdentityConfigured() ? {} : { robots: { index: false, follow: true } }),
});

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();
  const seller = getSellerInfo(settings);
  const contactEmail = seller.email.trim();
  const contactPhone = seller.phone.trim();
  const sellerReady = Boolean(
    seller.legalName.trim() &&
    seller.address.trim() &&
    seller.taxOffice.trim() &&
    seller.taxNumber.trim() &&
    contactEmail &&
    contactPhone
  );

  return (
    <ContentPageLayout>
      <div className="space-y-8">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Bilgilendirme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gizlilik Politikası ve KVKK Aydınlatma Metni
          </h1>
          <p className="text-sm text-muted-foreground">Son güncelleme: 24 Ekim 2026</p>
        </div>

        {!sellerReady ? (
          <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Satıcı kimlik ve iletişim bilgileri henüz tamamlanmadı. Sipariş kabulü, bu bilgiler tamamlanana kadar kapalıdır.
          </div>
        ) : null}

        <div className="prose text-foreground dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Veri Sorumlusu</h2>
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca kişisel verileriniz,
              veri sorumlusu sıfatıyla aşağıda bilgileri yer alan satıcı tarafından işlenmektedir.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Unvan:</strong> {seller.legalName.trim() || seller.storeName}</li>
              {seller.address.trim() ? (
                <li><strong className="text-foreground">Adres:</strong> {seller.address}</li>
              ) : null}
              {seller.taxOffice.trim() ? (
                <li><strong className="text-foreground">Vergi Dairesi:</strong> {seller.taxOffice}</li>
              ) : null}
              {seller.taxNumber.trim() ? (
                <li><strong className="text-foreground">Vergi Kimlik No / TCKN:</strong> {seller.taxNumber}</li>
              ) : null}
              {seller.mersis.trim() ? (
                <li><strong className="text-foreground">MERSİS:</strong> {seller.mersis}</li>
              ) : null}
              {contactEmail ? (
                <li><strong className="text-foreground">E-posta:</strong> {contactEmail}</li>
              ) : null}
              {contactPhone ? (
                <li><strong className="text-foreground">Telefon:</strong> {contactPhone}</li>
              ) : null}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. İşlenen Kişisel Veriler</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Ad, soyad, e-posta adresi ve telefon numarası</li>
              <li>Teslimat ve fatura adresi, il ve ilçe bilgisi</li>
              <li>Sipariş içeriği, tutar, ödeme yöntemi ve sipariş geçmişi</li>
              <li>Kurumsal fatura talebinde firma unvanı, vergi dairesi ve vergi kimlik numarası</li>
              <li>Hesap güvenliği ve oturum yönetimine ilişkin teknik kayıtlar</li>
              <li>Sepet, son görüntülenen ürünler ve son aramalar gibi hizmete ilişkin tercih verileri</li>
              <li>Açık onay verdiyseniz analitik ve pazarlama ölçüm verileri</li>
            </ul>
            <p className="text-muted-foreground">
              Sitemizde kredi kartı bilgisi toplanmaz ve saklanmaz. Ödeme, havale/EFT veya kapıda ödeme
              yöntemiyle gerçekleştirilir; bu süreçte yalnızca siparişin ve ödemenin yürütülmesi için
              gerekli bilgiler işlenir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. İşleme Amaçları ve Hukuki Sebepler</h2>
            <p>Kişisel verileriniz KVKK&apos;nın 5. maddesi kapsamında aşağıdaki amaçlarla işlenir:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Siparişin oluşturulması, ödemenin alınması ve teslimatın gerçekleştirilmesi (sözleşmenin ifası)</li>
              <li>Fatura düzenlenmesi ve yasal ticari kayıtların tutulması (hukuki yükümlülük)</li>
              <li>Müşteri destek taleplerinin yanıtlanması (sözleşmenin ifası ve meşru menfaat)</li>
              <li>Dolandırıcılık ve kötüye kullanımın önlenmesi (meşru menfaat)</li>
              <li>Kampanya ve bilgilendirme e-postaları (yalnızca açık onayınız varsa)</li>
              <li>Analitik ve reklam ölçümü (yalnızca açık onayınız varsa)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Çerezler ve Analitik</h2>
            <p>
              Zorunlu çerezler sepet, favoriler ve oturum güvenliği için kullanılır. Analitik ve pazarlama
              çerezleri yalnızca açık onayınızla etkinleşir; onay vermediğinizde bu araçlar çalışmaz.
              Kullanılan anahtarlar ve saklama süreleri için{" "}
              <Link href={routes.cookiePolicy} className="text-primary underline">Çerez Politikası</Link>{" "}
              sayfasını inceleyebilirsiniz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Verilerin Aktarılması</h2>
            <p>
              Kişisel verileriniz; barındırma ve veritabanı hizmeti, ödeme hizmeti, kargo teslimatı ve
              e-posta gönderimi için hizmet aldığımız tedarikçilere, yalnızca ilgili hizmetin gerektirdiği
              ölçüde aktarılır. Convex, Resend ve onay verdiğinizde Meta Pixel yurt dışında sunucu
              bulundurabilir; bu aktarımlar hizmetin ifası ve KVKK&apos;nın 9. maddesi kapsamında yapılır.
              Yasal zorunluluk halinde yetkili kamu kurumlarına aktarım yapılabilir. Onay vermediğiniz sürece
              pazarlama amacıyla üçüncü taraflarla veri paylaşılmaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Saklama Süresi</h2>
            <p>
              Veriler, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen yasal saklama süreleri
              boyunca tutulur. Ticari kayıtlar mevzuat gereği saklanır; analitik kimlikleri izin geri alındığında
              silinir. Süre sonunda kişisel veriler silinir, yok edilir veya anonim hale getirilir.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Sipariş ve fatura kayıtları: yasal saklama süreleri boyunca (ticari mevzuat)</li>
              <li>İletişim mesajları: talebin sonuçlanmasından itibaren en fazla 2 yıl</li>
              <li>Stok bildirimi aboneliği: bildirim talebi geri alınana kadar</li>
              <li>Aktif sepet kaydı: son hareketsizlikten itibaren 48 saat</li>
              <li>Analitik ve pazarlama izinleri: 180 gün veya izin geri alınana kadar</li>
              <li>E-posta gönderim kayıtları: operasyonel ihtiyaç için en fazla 1 yıl</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. İlgili Kişi Hakları</h2>
            <p>
              KVKK&apos;nın 11. maddesi kapsamında; kişisel verilerinizin işlenip işlenmediğini öğrenme,
              işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış
              işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, aktarıldığı üçüncü
              kişileri öğrenme ve zararın giderilmesini talep etme haklarına sahipsiniz.
            </p>
            <p>
              Taleplerinizi{" "}
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="text-primary underline">{contactEmail}</a>
              ) : (
                <Link href={routes.contact} className="text-primary underline">müşteri iletişim sayfamız</Link>
              )}{" "}
              üzerinden iletebilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Veri Güvenliği</h2>
            <p>
              Kişisel verileriniz yetkisiz erişim, kayıp ve kötüye kullanıma karşı teknik ve idari tedbirlerle
              korunur. Erişimler yetkiyle sınırlandırılır; ödeme kartı verileri sistemlerimizde tutulmaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. İletişim</h2>
            <p>
              Gizlilik ve KVKK konularındaki sorularınız için{" "}
              <Link href={routes.contact} className="text-primary underline">iletişim bölümünü</Link>{" "}
              kullanabilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </ContentPageLayout>
  );
}
