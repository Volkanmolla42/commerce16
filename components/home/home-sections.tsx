import {
  CheckBadgeIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import type { Category, Product } from "@/lib/catalog/types";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";

export function CategoryShortcuts({ categories }: { categories: Category[] }) {
  const visibleCategories = categories.filter((category) => category.slug !== "");
  if (visibleCategories.length === 0) return null;

  return (
    <nav aria-label="Kategoriler" className="border-b border-border/60 py-4 sm:py-6">
      <ul className="flex snap-x snap-mandatory items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] sm:justify-center sm:gap-6">
        {visibleCategories.map((category) => (
          <li key={category.slug} className="w-18 shrink-0 snap-start sm:w-22">
            <Link
              href={category.path}
              className="group flex flex-col items-center gap-2 rounded-xl p-1.5 text-center text-xs font-medium text-muted-foreground transition duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="relative grid size-13 place-items-center overflow-hidden rounded-2xl border border-border/80 bg-muted/40 text-foreground/80 shadow-xs transition duration-200 group-hover:scale-105 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary sm:size-15">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 60px, 52px"
                    className="object-cover transition-transform duration-300 group-hover:scale-108"
                  />
                ) : (
                  <TagIcon aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </span>
              <span className="line-clamp-2 leading-tight tracking-tight group-hover:text-foreground">
                {category.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function HomeHero({
  storeName,
  slogan,
  productCount,
}: {
  storeName: string;
  slogan?: string;
  productCount: number;
}) {
  const displaySlogan = slogan?.trim() || "Kaliteli ve seçkin ürünler en uygun fiyatlarla kapınızda.";

  return (
    <section
      aria-label="Vitrin Karşılama"
      className="relative my-4 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/50 via-background to-background px-6 py-10 text-center sm:my-6 sm:px-12 sm:py-16"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_35%_at_50%_0%,theme(colors.primary/0.1),transparent_100%)]" />
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          {displaySlogan}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Özenle seçilmiş {productCount > 0 ? `${productCount}+ seçkin` : ""} ürünü keşfedin, güvenli ve hızlı alışverişin tadını çıkarın.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/search"
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Tüm Ürünleri İncele
          </Link>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="mt-10 grid grid-cols-1 gap-4 border-t border-border/60 pt-8 sm:grid-cols-3 sm:gap-6">
        <div className="flex items-center justify-center gap-3 text-left">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <TruckIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Hızlı ve Güvenli Teslimat</p>
            <p className="text-[11px] text-muted-foreground">Siparişleriniz özenle paketlenir</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 text-left">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">256-Bit SSL Güvenli Ödeme</p>
            <p className="text-[11px] text-muted-foreground">Korumalı ödeme altyapısı</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 text-left">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CheckBadgeIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">%100 Orijinal Ürün</p>
            <p className="text-[11px] text-muted-foreground">Koşulsuz iade ve değişim güvencesi</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeProductShelf({ title, products }: { title: string; products: Product[] }) {
  if (products.length === 0) return null;
  const fitsRow = products.length <= 4;
  const compactColumns = products.length === 1
    ? "grid-cols-1"
    : products.length === 2
      ? "grid-cols-2"
      : products.length === 3
        ? "grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  const shelfWidth = products.length === 1
    ? "mx-auto max-w-sm"
    : fitsRow ? "mx-auto max-w-5xl" : "";

  return (
    <section className="py-7 sm:py-9" aria-label={title}>
      <div className={`${shelfWidth} mb-4 flex items-center justify-between gap-4 sm:mb-5`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">En çok tercih edilen popüler modeller</p>
        </div>
        <Link
          href="/search"
          className="shrink-0 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Tümünü Gör
        </Link>
      </div>
      <Grid className={fitsRow
        ? `${shelfWidth} ${compactColumns} gap-3 sm:gap-4`
        : "grid-flow-col auto-cols-[minmax(11rem,72vw)] gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [&>*]:[scroll-snap-align:start] sm:auto-cols-[14rem] sm:gap-4 lg:auto-cols-[16rem]"}>
        <ProductGridItems
          products={products}
          imageSizes={products.length === 1
            ? "(min-width: 640px) 384px, calc(100vw - 2rem)"
            : fitsRow ? "(min-width: 1024px) 320px, (min-width: 640px) 224px, 50vw" : "(min-width: 1024px) 256px, (min-width: 640px) 224px, 72vw"}
          prioritizeFirst
          cardLayout="stacked"
          imageFit="cover"
        />
      </Grid>
    </section>
  );
}
