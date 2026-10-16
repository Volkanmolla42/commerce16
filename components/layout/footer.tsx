import Link from "next/link";
import Image from "next/image";
import StoreInitial from "@/components/store-initial";
import { getMenu, getStoreSettings } from "@/lib/catalog";
import { Menu } from "@/lib/catalog/types";
import { cacheTag } from "next/cache";
import { CookiePreferencesButton } from "@/components/privacy/cookie-consent-manager";
import {
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";

import { formatDate } from "@/lib/format-date";
import { formatPhone } from "@/lib/orders";

export default async function Footer() {
  "use cache";
  cacheTag("store-settings");
  cacheTag("categories");
  const copyrightDate = formatDate(new Date(), { year: "numeric" });
  const [menu, settings] = await Promise.all([
    getMenu(),
    getStoreSettings(),
  ]);

  const hasContact = Boolean(settings.phone || settings.email || settings.address);

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50 pb-24 text-sm dark:border-neutral-800 dark:bg-neutral-900 md:pb-0">
      {/* Ana kolonlar */}
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-4">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2.5 text-black transition-opacity hover:opacity-80 dark:text-white"
            >
              {settings.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700 dark:bg-neutral-950"
                />
              ) : (
                <StoreInitial storeName={settings.storeName} size="sm" />
              )}
              <span className="text-sm font-semibold uppercase tracking-wider">{settings.storeName}</span>
            </Link>

            {settings.slogan ? (
              <p className="max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {settings.slogan}
              </p>
            ) : null}

            {hasContact && (
              <ul className="mt-1 flex flex-col gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
                {settings.phone && (
                  <li>
                    <a href={`tel:${settings.phone}`} className="inline-flex items-center gap-2.5 transition-colors hover:text-black dark:hover:text-white">
                      <PhoneIcon className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                      {formatPhone(settings.phone)}
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
                {settings.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                    <span className="leading-snug">{settings.address}</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          <nav aria-label="Kategoriler" className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Kategoriler
            </h3>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              {menu.length > 0 ? (
                menu.map((item: Menu) => (
                  <li key={item.title}>
                    <Link href={item.path} className="transition-colors hover:text-black dark:hover:text-white">
                      {item.title}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-neutral-400 dark:text-neutral-500">Henüz kategori eklenmemiş.</li>
              )}
            </ul>
          </nav>

          <nav aria-label="Kurumsal" className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Kurumsal
            </h3>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li>
                <Link href="/about" className="transition-colors hover:text-black dark:hover:text-white">
                  Hakkımızda
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-black dark:hover:text-white">
                  İletişim
                </Link>
              </li>
              <li>
                <Link href="/terms-conditions" className="transition-colors hover:text-black dark:hover:text-white">
                  Kullanım Koşulları
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="transition-colors hover:text-black dark:hover:text-white">
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
                <Link href="/distance-sales-agreement" className="transition-colors hover:text-black dark:hover:text-white">
                  Mesafeli Satış Sözleşmesi
                </Link>
              </li>
              <li>
                <Link href="/pre-information-form" className="transition-colors hover:text-black dark:hover:text-white">
                  Ön Bilgilendirme Formu
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Alt bar */}
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-col items-center justify-between gap-4 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            &copy; {copyrightDate} {settings.storeName}. Tüm hakları saklıdır.
          </p>

          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
