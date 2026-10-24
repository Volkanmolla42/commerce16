import { routes } from "@/lib/storefront-routes";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { storeConfig, getSellerInfo } from "@/lib/store-config";
import ContactForm from "./contact-form";
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export const metadata = pageMetadata({
  title: "Hakkımızda",
  description: `${storeConfig.name} hakkında bilgi alın, iletişim bilgilerine ulaşın veya mesaj gönderin.`,
  path: routes.about,
});

export default async function AboutPage() {
  const settings = await getStoreSettings();
  const seller = getSellerInfo(settings);
  const hasContact = Boolean(settings.phone || settings.email || seller.address);

  return (
    <ContentPageLayout>
      <div className="space-y-10">
        <div className="space-y-3 border-b border-border pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Kurumsal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Hakkımızda
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {storeConfig.slogan}
          </p>
        </div>

        <section id="iletisim" className="scroll-mt-24 space-y-6">
          <div className="space-y-3 border-b border-border pb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Müşteri Hizmetleri
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Bizimle İletişime Geçin
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              Sorularınız, önerileriniz veya siparişlerinizle ilgili her türlü konuda ekibimize mesaj gönderebilirsiniz. Size en kısa sürede dönüş yapacağız.
            </p>
          </div>

          <div className={`grid items-start gap-10 ${hasContact ? "lg:grid-cols-12" : ""}`}>
            {hasContact ? (
              <div className="space-y-6 lg:col-span-5">
                <div className="space-y-6 rounded-2xl border border-border bg-muted/30 p-6">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                    İletişim Bilgileri
                  </h3>

                  <ul className="space-y-5 text-sm">
                    {settings.phone && (
                      <li className="flex items-start gap-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <PhoneIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Telefon
                          </span>
                          <a
                            href={`tel:${settings.phone}`}
                            className="font-medium text-foreground transition-colors hover:text-primary"
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
                          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            E-posta
                          </span>
                          <a
                            href={`mailto:${settings.email}`}
                            className="font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {settings.email}
                          </a>
                        </div>
                      </li>
                    )}

                    {seller.address && (
                      <li className="flex items-start gap-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <MapPinIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Adres
                          </span>
                          <span className="font-medium leading-snug text-foreground">
                            {seller.address}
                          </span>
                        </div>
                      </li>
                    )}
                  </ul>

                  {(seller.legalName.trim() || seller.taxOffice.trim() || seller.taxNumber.trim() || seller.mersis.trim()) ? (
                    <div className="space-y-1 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                      {seller.legalName.trim() ? <p><span className="font-medium text-foreground">Unvan:</span> {seller.legalName}</p> : null}
                      {seller.taxOffice.trim() ? <p><span className="font-medium text-foreground">Vergi Dairesi:</span> {seller.taxOffice}</p> : null}
                      {seller.taxNumber.trim() ? <p><span className="font-medium text-foreground">Vergi No / TCKN:</span> {seller.taxNumber}</p> : null}
                      {seller.mersis.trim() ? <p><span className="font-medium text-foreground">MERSİS:</span> {seller.mersis}</p> : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-2xl border border-border/80 bg-background p-6">
                  <h3 className="text-sm font-semibold text-foreground">Hızlı Destek İpucu</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Mevcut bir siparişiniz hakkında bilgi almak istiyorsanız, lütfen mesajınıza <strong>Sipariş Numaranızı</strong> eklemeyi unutmayınız.
                  </p>
                </div>
              </div>
            ) : null}

            <div className={`rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8 ${hasContact ? "lg:col-span-7" : ""}`}>
              <h3 className="mb-1 text-xl font-bold text-foreground">Bize Mesaj Gönderin</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Aşağıdaki formu doldurarak bize doğrudan ulaşabilirsiniz.
              </p>
              <ContactForm />
            </div>
          </div>
        </section>
      </div>
    </ContentPageLayout>
  );
}
