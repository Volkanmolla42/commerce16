import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import {
  SparklesIcon,
  ShieldCheckIcon,
  HeartIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `Hakkımızda | ${settings.storeName}`,
    description: settings.slogan || `${settings.storeName} hakkında bilgi edinin.`,
  };
}

export default async function AboutPage() {
  const settings = await getStoreSettings();

  return (
    <ContentPageLayout>
      <main className="space-y-10">
        {/* Header */}
        <div className="space-y-3 border-b border-border pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Kurumsal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Hakkımızda
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {settings.slogan
              ? `${settings.storeName} — ${settings.slogan}`
              : `${settings.storeName} olarak müşterilerimize en kaliteli ürünleri güvenle ulaştırıyoruz.`}
          </p>
        </div>

        {/* Story Section */}
        <div className="space-y-4 text-foreground/90 leading-relaxed text-sm sm:text-base">
          <p>
            <strong>{settings.storeName}</strong>, modern e-ticaret standartlarında güvenli, hızlı ve
            keyifli bir alışveriş deneyimi sunmak amacıyla kurulmuştur. Geniş ürün yelpazemiz ve müşteri
            odaklı hizmet anlayışımızla her siparişi özenle hazırlıyor, en hızlı şekilde sizlere ulaştırıyoruz.
          </p>
          <p>
            Müşteri memnuniyetini her zaman ön planda tutarak, satış öncesinde ve sonrasında kesintisiz
            destek sunmayı ilke ediniyoruz.
          </p>
        </div>

        {/* Pillars / Values */}
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Güvenli Alışveriş</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tüm ödemeleriniz 256-Bit SSL şifreleme ve 3D Secure güvencesiyle korunur.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Orijinal Ürünler</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Özenle seçilmiş, kalite standartlarına uygun %100 orijinal ürünler.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HeartIcon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Müşteri Desteği</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sorularınız ve talepleriniz için her zaman yanınızdayız.
            </p>
          </div>
        </div>

        {/* Contact Info */}
        {(settings.phone || settings.email || settings.address) && (
          <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">İletişim Bilgileri</h2>
            <div className="grid gap-3 sm:grid-cols-3 text-xs sm:text-sm text-muted-foreground">
              {settings.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-primary shrink-0" />
                  <a href={`tel:${settings.phone}`} className="hover:text-foreground transition-colors">
                    {settings.phone}
                  </a>
                </div>
              )}
              {settings.email && (
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="h-4 w-4 text-primary shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-foreground transition-colors">
                    {settings.email}
                  </a>
                </div>
              )}
              {settings.address && (
                <div className="flex items-center gap-2 sm:col-span-3">
                  <MapPinIcon className="h-4 w-4 text-primary shrink-0" />
                  <span>{settings.address}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </ContentPageLayout>
  );
}
