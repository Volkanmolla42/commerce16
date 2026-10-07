import Link from "next/link";
import Image from "next/image";
import LogoSquare from "@/components/logo-square";
import { getMenu, getStoreSettings } from "@/lib/catalog";
import { Menu } from "@/lib/catalog/types";
import { cacheTag } from "next/cache";
import { CookiePreferencesButton } from "@/components/privacy/cookie-consent-manager";

export default async function Footer() {
  "use cache";
  cacheTag("store-settings");
  const copyrightDate = new Date().getFullYear();
  const [menu, settings] = await Promise.all([
    getMenu(),
    getStoreSettings(),
  ]);

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50/50 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 lg:gap-12">
          {/* 1. Sütun: Marka Tanıtımı */}
          <div className="flex flex-col gap-4">
            <Link
              className="flex items-center gap-2.5 text-black transition hover:opacity-90 dark:text-white"
              href="/"
            >
              {settings.logoUrl ? (
                <Image src={settings.logoUrl} alt={settings.storeName} width={30} height={30} unoptimized className="h-[30px] w-[30px] rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700 dark:bg-black" />
              ) : (
                <LogoSquare size="sm" />
              )}
              <span className="text-base font-semibold tracking-wider uppercase">
                {settings.storeName}
              </span>
            </Link>
            {settings.slogan && (
              <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {settings.slogan}
              </p>
            )}
            {[settings.phone, settings.email, settings.address].some(Boolean) && (
              <div className="flex flex-col gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                {settings.phone && <span>{settings.phone}</span>}
                {settings.email && <span>{settings.email}</span>}
                {settings.address && <span>{settings.address}</span>}
              </div>
            )}
          </div>

          {/* 2. Sütun: Kategoriler */}
          <div>
            <h3 className="mb-4 text-xs font-semibold tracking-wider uppercase text-black dark:text-white">
              Kategoriler
            </h3>
            <ul className="flex flex-col gap-2.5">
              {menu.map((item: Menu) => (
                <li key={item.title}>
                  <Link
                    href={item.path}
                    className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Sütun: Kurumsal / Bilgi */}
          <div>
            <h3 className="mb-4 text-xs font-semibold tracking-wider uppercase text-black dark:text-white">
              Kurumsal
            </h3>
            <ul className="flex flex-col gap-2.5">
              <li><Link href="/about" className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white">Hakkımızda</Link></li>
              <li><Link href="/terms-conditions" className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white">Kullanım Koşulları</Link></li>
              <li><Link href="/privacy-policy" className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white">Gizlilik Politikası</Link></li>
              <li><Link href="/distance-sales-agreement" className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white">Mesafeli Satış Sözleşmesi</Link></li>
              <li><Link href="/pre-information-form" className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white">Ön Bilgilendirme Formu</Link></li>
            </ul>
          </div>

        </div>

        {/* Alt Çizgi ve Telif */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-8 sm:flex-row dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
              &copy; {copyrightDate} {settings.storeName}. Tüm hakları saklıdır.
          </p>
          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
