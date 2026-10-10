import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `Gizlilik Politikası | ${settings.storeName}`,
    description: `${settings.storeName} gizlilik ve kişisel verilerin korunması politikası.`,
  };
}

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();

  return (
    <ContentPageLayout>
      <main className="space-y-8">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Bilgilendirme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gizlilik Politikası ve KVKK Aydınlatma Metni
          </h1>
        </div>

        <div className="prose text-foreground dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Veri Sorumlusu</h2>
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca,{" "}
              <strong>{settings.storeName}</strong> olarak veri sorumlusu sıfatıyla kişisel verilerinizi
              aşağıda belirtilen çerçevede işlemekteyiz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. İşlenen Kişisel Veriler ve Amaçları</h2>
            <p>
              Siparişlerinizin oluşturulması, teslimatın gerçekleştirilmesi, faturalandırma süreçleri ve müşteri
              hizmetleri desteği sağlanabilmesi amacıyla ad, soyad, teslimat adresi, e-posta adresi ve telefon
              numaranız işlenmektedir.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Sipariş takibi, kargo ve teslimat süreçlerinin yürütülmesi</li>
              <li>Yasal fatura ve muhasebe yükümlülüklerinin yerine getirilmesi</li>
              <li>Müşteri destek taleplerinin yanıtlanması</li>
              <li>İzniniz doğrultusunda kampanya ve bilgilendirme duyuruları</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Veri Güvenliği</h2>
            <p>
              Kişisel verileriniz güncel güvenlik standartlarına uygun olarak korunmaktadır. Ödeme işlemleri
              esnasında kart bilgileriniz sistemlerimizde saklanmamakta olup, BDDK lisanslı güvenli ödeme
              altyapısı ve 256-Bit SSL şifreleme üzerinden bankalara iletilmektedir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. İlgili Kişi Hakları</h2>
            <p>
              KVKK&apos;nın 11. maddesi kapsamında kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi
              talep etme, düzeltilmesini veya silinmesini isteme hakkına sahipsiniz. Taleplerinizi{" "}
              <a href={`mailto:${settings.email || "destek@magaza.com"}`} className="text-primary underline">
                {settings.email || "destek@magaza.com"}
              </a>{" "}
              e-posta adresimize iletebilirsiniz.
            </p>
          </section>
        </div>
      </main>
    </ContentPageLayout>
  );
}
