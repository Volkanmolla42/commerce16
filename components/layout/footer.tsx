import Link from "next/link";
import LogoSquare from "@/components/logo-square";
import { getMenu, getPages } from "@/lib/catalog";
import { Menu } from "@/lib/catalog/types";

const rawSiteName = process.env.SITE_NAME || "Commerce";
const SITE_NAME = rawSiteName.replace(/acme\s*/gi, "").trim() || "Commerce";

const rawCompanyName = process.env.COMPANY_NAME || "Commerce Inc.";
const COMPANY_NAME = rawCompanyName.replace(/acme\s*/gi, "").trim() || "Commerce Inc.";

export default async function Footer() {
  "use cache"
  const copyrightDate = new Date().getFullYear();
  const [menu, pages] = await Promise.all([getMenu(), getPages()]);

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50/50 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 lg:gap-12">
          {/* 1. Sütun: Marka Tanıtımı */}
          <div className="flex flex-col gap-4">
            <Link
              className="flex items-center gap-2.5 text-black transition hover:opacity-90 dark:text-white"
              href="/"
            >
              <LogoSquare size="sm" />
              <span className="text-base font-semibold tracking-wider uppercase">
                {SITE_NAME}
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              Modern hassasiyet ve birinci sınıf malzemelerle tasarlanan, yüksek performanslı yeni nesil e-ticaret deneyimi.
            </p>
            <div className="pt-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span>Güvenli & Hızlı Alışveriş</span>
            </div>
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
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/${page.slug}`}
                    className="transition hover:text-black hover:underline underline-offset-4 dark:hover:text-white"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Sütun: E-Bülten */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-black dark:text-white">
              Bültene Katılın
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Yeni ürünler ve özel indirimlerden anında haberdar olun.
            </p>
            <form
              onSubmit={undefined}
              className="mt-1 flex flex-col gap-2"
              action="#"
            >
              <input
                id="newsletter-email"
                name="email"
                type="email"
                placeholder="E-posta adresiniz..."
                required
                className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm text-black placeholder:text-neutral-400 transition focus:border-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Abone Ol
              </button>
            </form>
          </div>
        </div>

        {/* Alt Çizgi ve Telif */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-8 sm:flex-row dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            &copy; {copyrightDate} {COMPANY_NAME}. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
            <span>256-Bit SSL Şifreleme</span>
            <span>&bull;</span>
            <span>Ücretsiz İade Garantisi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
