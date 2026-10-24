import { routes } from "@/lib/storefront-routes";
import Link from "next/link";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { getSellerInfo, isLegalIdentityConfigured, storeConfig } from "@/lib/store-config";

export const metadata = pageMetadata({
  title: "Kullanım Koşulları",
  description: `${storeConfig.name} web sitesi kullanım ve alışveriş koşulları.`,
  path: routes.termsConditions,
  ...(isLegalIdentityConfigured() ? {} : { robots: { index: false, follow: true } }),
});

export default async function TermsConditionsPage() {
  const seller = getSellerInfo(await getStoreSettings());
  const sellerReady = Boolean(
    seller.legalName.trim() &&
    seller.address.trim() &&
    seller.taxOffice.trim() &&
    seller.taxNumber.trim() &&
    seller.email.trim() &&
    seller.phone.trim()
  );

  return (
    <ContentPageLayout>
      <div className="space-y-8">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Bilgilendirme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kullanım ve Satış Koşulları
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
            <h2 className="text-xl font-semibold text-foreground">1. Satıcı Bilgileri</h2>
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
              {seller.email.trim() ? (
                <li><strong className="text-foreground">E-posta:</strong> {seller.email}</li>
              ) : null}
              {seller.phone.trim() ? (
                <li><strong className="text-foreground">Telefon:</strong> {seller.phone}</li>
              ) : null}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Genel Hükümler</h2>
            <p>
              Bu web sitesini kullanarak aşağıdaki kullanım koşullarını okuduğunuzu kabul etmiş olursunuz.
              Sipariş verirken ödeme adımında Kullanım Koşulları&apos;nı ayrıca onaylamanız gerekir. Satıcı,
              koşullarda değişiklik yaparsa güncel metni bu sayfada yayımlar. Siparişin verildiği anda
              yürürlükte olan metin uygulanır.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Sipariş ve Fiyatlandırma</h2>
            <p>
              Sitemizde listelenen fiyatlar Türk Lirası (TL) cinsindendir ve yasal vergileri içerir. Kargo ve
              varsa ödeme hizmeti bedelleri ödeme öncesinde sipariş özetinde ayrıca gösterilir. Dizgi veya
              sistemsel hata kaynaklı bariz fiyat yanlışlıklarında müşteri bilgilendirilerek sipariş iptal
              edilebilir veya düzeltilebilir; bu durumda müşteriye hiçbir ödeme yükü doğmaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Teslimat</h2>
            <p>
              Siparişler anlaşmalı kargo firmaları aracılığıyla, sipariş onayından itibaren yasal 30 günlük
              süreyi aşmamak kaydıyla teslimat adresine gönderilir. Teslimat süresi, stok ve kargo koşullarına
              göre değişebilir; tahmini süre ürün sayfasında ve sipariş özetinde belirtilir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Cayma Hakkı, İade ve Geri Ödeme</h2>
            <p>
              Tüketiciler, ürünün teslim alındığı tarihten itibaren 14 (on dört) gün içinde gerekçe
              göstermeksizin cayma hakkına sahiptir. Cayma hakkının kullanımı, iade koşulları, istisnalar ve
              geri ödeme süreci için{" "}
              <Link href={routes.refundPolicy} className="text-primary underline">İade ve Cayma Hakkı Politikası</Link>{" "}
              sayfasını inceleyin.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Fikri Mülkiyet</h2>
            <p>
              Web sitemizde yer alan tasarım, metin, logo ve yazılım kodları Satıcı veya lisansörlerine aittir.
              Ürün fotoğrafları ve açıklamaları, hak sahibi tarafından sağlanan veya kullanım izni bulunan
              içeriklerden oluşur; yazılı izin olmaksızın kopyalanamaz veya ticari amaçla kullanılamaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Kişisel Veriler ve Çerezler</h2>
            <p>
              Kişisel verilerin işlenmesine ilişkin bilgilere{" "}
              <Link href={routes.privacyPolicy} className="text-primary underline">Gizlilik Politikası</Link>,
              çerez tercihlerine ve saklama sürelerine ilişkin bilgilere{" "}
              <Link href={routes.cookiePolicy} className="text-primary underline">Çerez Politikası</Link>{" "}
              sayfasından ulaşabilirsiniz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Uyuşmazlık Çözümü</h2>
            <p>
              İşbu koşulların uygulanmasında Ticaret Bakanlığı tarafından ilan edilen parasal sınırlar dâhilinde
              Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir. Sorularınız için{" "}
              <Link href={routes.contact} className="text-primary underline">iletişim bölümünü</Link>{" "}
              kullanabilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </ContentPageLayout>
  );
}
