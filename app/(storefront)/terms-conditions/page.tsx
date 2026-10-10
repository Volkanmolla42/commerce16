import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `Kullanım Koşulları | ${settings.storeName}`,
    description: `${settings.storeName} web sitesi kullanım ve alışveriş koşulları.`,
  };
}

export default async function TermsConditionsPage() {
  const settings = await getStoreSettings();

  return (
    <ContentPageLayout>
      <main className="space-y-8">
        <div className="border-b border-border pb-6 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Yasal Bilgilendirme
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kullanım ve Satış Koşulları
          </h1>
        </div>

        <div className="prose text-foreground dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Genel Hükümler</h2>
            <p>
              Bu web sitesini ziyaret ederek veya sipariş vererek <strong>{settings.storeName}</strong> tarafından
              belirlenen aşağıdaki kullanım koşullarını kabul etmiş sayılırsınız. {settings.storeName}, koşullarda
              önceden bildirmeksizin değişiklik yapma hakkını saklı tutar.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Sipariş ve Fiyatlandırma</h2>
            <p>
              Sitemizde listelenen tüm ürün fiyatları Türk Lirası (TL) cinsinden olup yasal vergileri içerir.
              Sipariş verildiği anda sistemde kayıtlı fiyatlar geçerlidir. Dizgi veya sistemsel hata kaynaklı bariz fiyat
              yanlışlıklarında müşteri bilgilendirilerek sipariş iptal edilebilir veya düzeltilebilir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Teslimat ve İade</h2>
            <p>
              Siparişleriniz anlaşmalı kargo firmaları aracılığıyla teslimat adresinize ulaştırılır. Tüketiciler,
              ürünü teslim aldığı tarihten itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin
              cayma hakkını kullanabilir. İade sürecinde ürünün ambalajının hasar görmemiş ve tekrar satılabilir
              durumda olması gerekmektedir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Fikri Mülkiyet</h2>
            <p>
              Web sitemizde yer alan tüm tasarım, metin, logo, grafik ve yazılım kodları {settings.storeName} ve
              lisansörlerinin mülkiyetindedir; yazılı izin olmaksızın kopyalanamaz veya ticari amaçla kullanılamaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Uyuşmazlık Çözümü</h2>
            <p>
              İşbu koşulların uygulanmasında Ticaret Bakanlığı tarafından ilan edilen değere kadar Tüketici Hakem
              Heyetleri ile Tüketici Mahkemeleri yetkilidir.
            </p>
          </section>
        </div>
      </main>
    </ContentPageLayout>
  );
}
