import type { Metadata } from "next";
import ContentPageLayout from "@/components/layout/content-page-layout";
import { getStoreSettings } from "@/lib/catalog";
import {
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
            {settings.slogan || `${settings.storeName} online mağazası`}
          </p>
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
