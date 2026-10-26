import { routes } from "@/lib/storefront-routes";
import Link from "next/link";
import Image from "next/image";
import { getMenu, getStoreSettings } from "@/lib/catalog";
import { storeConfig } from "@/lib/store-config";
import { Menu } from "@/lib/catalog/types";
import { cacheTag } from "next/cache";
import { CookiePreferencesButton } from "@/components/privacy/cookie-consent-manager";
import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";

import { formatDate } from "@/lib/format-date";
import { formatPhone, formatWhatsAppUrl } from "@/lib/orders";
import { WhatsAppIcon } from "@/components/icons/social-icons";

export default async function Footer() {
  "use cache";
  cacheTag("store-settings");
  cacheTag("categories");
  const copyrightDate = formatDate(new Date(), { year: "numeric" });
  const [menu, settings] = await Promise.all([
    getMenu(),
    getStoreSettings(),
  ]);

  const hasContact = Boolean(settings.phone || settings.email || storeConfig.address);
  const whatsappUrl = formatWhatsAppUrl(settings.phone, "Merhaba, ürünleriniz hakkında bilgi almak istiyorum.");

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50 pb-24 text-sm dark:border-neutral-800 dark:bg-neutral-900 md:pb-0">
      {/* Ana kolonlar */}
      <div className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-4">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2.5 text-black transition-opacity hover:opacity-80 dark:text-white"
            >
              <Image
                src={storeConfig.logo}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700"
              />
              <span className="text-sm font-semibold uppercase tracking-wider">{storeConfig.name}</span>
            </Link>

            {storeConfig.slogan ? (
              <p className="max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {storeConfig.slogan}
              </p>
            ) : null}

            {hasContact && (
              <ul className="mt-1 flex flex-col gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">                {settings.phone && (
                  <li>
                    <a href={`tel:${settings.phone}`} className="inline-flex items-center gap-2.5 transition-colors hover:text-black dark:hover:text-white">
                      <PhoneIcon className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                      {formatPhone(settings.phone)}
                    </a>
                  </li>
                )}
                {whatsappUrl && (
                  <li>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 transition-colors hover:text-black dark:hover:text-white">
                      <WhatsAppIcon className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                      WhatsApp
                    </a>
                  </li>
                )}
                {settings.email && (
                  <li>
                    <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-2.5 transition-colors hover:text-black dark:hover:text-white">
                      <EnvelopeIcon className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                      {settings.email}
                    </a>
                  </li>
                )}
                {storeConfig.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                    <span className="leading-snug">{storeConfig.address}</span>
                  </li>
                )}
              </ul>
            )}

            {storeConfig.legalName ? (
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Unvan:</span> {storeConfig.legalName}
                {storeConfig.taxOffice ? <> · <span className="font-medium text-neutral-700 dark:text-neutral-300">Vergi Dairesi:</span> {storeConfig.taxOffice}</> : null}
                {storeConfig.taxNumber ? <> · <span className="font-medium text-neutral-700 dark:text-neutral-300">Vergi No / TCKN:</span> {storeConfig.taxNumber}</> : null}
                {storeConfig.mersis ? <> · <span className="font-medium text-neutral-700 dark:text-neutral-300">MERSİS:</span> {storeConfig.mersis}</> : null}
              </p>
            ) : null}
          </div>

          <nav aria-label="Kategoriler" className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Kategoriler
            </h3>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              {menu.length > 0 ? (
                <>
                  {menu.slice(0, 8).map((item: Menu) => (
                    <li key={item.path}>
                      <Link href={item.path} className="transition-colors hover:text-black dark:hover:text-white">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                  {menu.length > 8 && (
                    <li className="pt-1">
                      <Link
                        href={routes.search}
                        className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition-colors hover:text-black dark:hover:text-white"
                      >
                        Tüm Kategoriler ({menu.length}) →
                      </Link>
                    </li>
                  )}
                </>
              ) : (
                <li className="text-muted-foreground">Henüz kategori eklenmemiş.</li>
              )}
            </ul>
          </nav>

          <nav aria-label="Kurumsal" className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Kurumsal
            </h3>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li>
                <Link href={routes.about} className="transition-colors hover:text-black dark:hover:text-white">
                  Hakkımızda
                </Link>
              </li>
              <li>
                <Link href={routes.contact} className="transition-colors hover:text-black dark:hover:text-white">
                  İletişim
                </Link>
              </li>
              <li>
                <Link href={routes.termsConditions} className="transition-colors hover:text-black dark:hover:text-white">
                  Kullanım Koşulları
                </Link>
              </li>
              <li>
                <Link href={routes.privacyPolicy} className="transition-colors hover:text-black dark:hover:text-white">
                  Gizlilik Politikası
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Yasal bilgiler" className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Yasal
            </h3>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li>
                <Link href={routes.distanceSalesAgreement} className="transition-colors hover:text-black dark:hover:text-white">
                  Mesafeli Satış Sözleşmesi
                </Link>
              </li>
              <li>
                <Link href={routes.preInformationForm} className="transition-colors hover:text-black dark:hover:text-white">
                  Ön Bilgilendirme Formu
                </Link>
              </li>
              <li>
                <Link href={routes.refundPolicy} className="transition-colors hover:text-black dark:hover:text-white">
                  İade ve Cayma Hakkı
                </Link>
              </li>
              <li>
                <Link href={routes.cookiePolicy} className="transition-colors hover:text-black dark:hover:text-white">
                  Çerez Politikası
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Alt bar */}
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-4 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            &copy; {copyrightDate} {storeConfig.name}. Tüm hakları saklıdır.
          </p>

          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
