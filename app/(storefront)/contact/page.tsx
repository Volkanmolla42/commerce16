import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import ContactForm from "./contact-form";
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `İletişim | ${settings.storeName}`,
    description: `${settings.storeName} iletişim bilgileri ve müşteri destek formu.`,
  };
}

export default async function ContactPage() {
  const settings = await getStoreSettings();

  return (
    <ContentPageLayout>
      <main className="space-y-10">
        {/* Header */}
        <div className="space-y-3 border-b border-border pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Müşteri Hizmetleri
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Bizimle İletişime Geçin
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Sorularınız, önerileriniz veya siparişlerinizle ilgili her türlü konuda ekibimize mesaj gönderebilirsiniz. Size en kısa sürede dönüş yapacağız.
          </p>
        </div>

        {/* 2-Column Layout */}
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Sol Kolon: İletişim Kanalları & Bilgileri */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                İletişim Bilgileri
              </h2>

              <ul className="space-y-5 text-sm">
                {settings.phone && (
                  <li className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <PhoneIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Telefon
                      </span>
                      <a
                        href={`tel:${settings.phone}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {settings.phone}
                      </a>
                    </div>
                  </li>
                )}

                {settings.email && (
                  <li className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <EnvelopeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        E-posta
                      </span>
                      <a
                        href={`mailto:${settings.email}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {settings.email}
                      </a>
                    </div>
                  </li>
                )}

                {settings.address && (
                  <li className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MapPinIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Adres
                      </span>
                      <span className="font-medium text-foreground leading-snug">
                        {settings.address}
                      </span>
                    </div>
                  </li>
                )}

                <li className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClockIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Çalışma Saatleri
                    </span>
                    <span className="font-medium text-foreground">
                      Hafta içi 09:00 - 18:00
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background p-6 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Hızlı Destek İpucu</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mevcut bir siparişiniz hakkında bilgi almak istiyorsanız, lütfen mesajınıza <strong>Sipariş Numaranızı</strong> eklemeyi unutmayınız.
              </p>
            </div>
          </div>

          {/* Sağ Kolon: Mesaj Formu */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs lg:col-span-7">
            <h2 className="text-xl font-bold text-foreground mb-1">Bize Mesaj Gönderin</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Aşağıdaki formu doldurarak bize doğrudan ulaşabilirsiniz.
            </p>
            <ContactForm />
          </div>
        </div>
      </main>
    </ContentPageLayout>
  );
}
