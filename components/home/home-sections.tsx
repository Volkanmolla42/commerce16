import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import type { Category, Product } from "@/lib/catalog/types";
import { ProductGrid } from "@/components/product/product-grid";
import { getProductImages } from "@/lib/catalog/product-images";
import { ProductImageLink, ProductImageTransition } from "@/components/product/product-image-transition";

const valueProps = [
  { icon: TruckIcon, title: "Hızlı Teslimat", description: "Özenli paketleme, hızlı kargo" },
  { icon: ShieldCheckIcon, title: "Orijinal Ürün", description: "Doğrulanmış kalite güvencesi" },
  { icon: ArrowPathIcon, title: "Kolay İade", description: "14 gün içinde koşulsuz iade" },
  { icon: LockClosedIcon, title: "Güvenli Ödeme", description: "3D Secure ödeme altyapısı" },
];

export function HomeValueProps() {
  return (
    <section aria-label="Mağaza güvenceleri" className="grid grid-cols-2 gap-x-6 gap-y-5 py-8 lg:grid-cols-4">
      {valueProps.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="flex items-center gap-3">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function CategoryShortcuts({ categories }: { categories: Category[] }) {
  const visibleCategories = categories.filter((category) => category.slug !== "");
  if (visibleCategories.length === 0) return null;

  return (
    <nav id="kategoriler" aria-label="Kategoriler" className="border-b border-border/60 py-4 sm:py-6">
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
  featuredProduct,
  hasCategories,
}: {
  storeName: string;
  slogan?: string;
  featuredProduct?: Product;
  hasCategories: boolean;
}) {
  const heroImage = featuredProduct ? getProductImages(featuredProduct)[0] : undefined;
  const heading = slogan?.trim() || "Yeni favorinizi bulun.";

  return (
    <section
      aria-label="Vitrin Karşılama"
      className={`my-4 overflow-hidden rounded-3xl border border-border/60 bg-card text-foreground sm:my-6 ${heroImage ? "lg:grid lg:grid-cols-[1fr_1.05fr]" : ""}`}
    >
      <div className={`flex flex-col items-start justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16 ${heroImage ? "" : "mx-auto max-w-3xl"}`}>
        <p className="mb-5 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:mb-8 sm:text-xs">
          {storeName}
        </p>
        <h1 className="max-w-[18ch] text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl xl:text-6xl">
          {heading}
        </h1>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-9">
          <Link
            href="/search"
            className="inline-flex min-h-12 items-center justify-center gap-5 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-85"
          >
            Ürünleri keşfet
            <ArrowUpRightIcon className="size-4" aria-hidden="true" />
          </Link>
          {hasCategories ? (
            <Link href="#kategoriler" className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground">
              Kategorilere göz at
            </Link>
          ) : null}
        </div>
      </div>

      {heroImage && featuredProduct ? (
        <ProductImageLink
          productId={featuredProduct.id}
          href={`/product/${featuredProduct.slug}`}
          aria-label={`${featuredProduct.title} ürününü incele`}
          className="group relative block aspect-[6/5] overflow-hidden bg-neutral-100 sm:aspect-[4/3] lg:aspect-auto lg:min-h-[520px]"
        >
          <ProductImageTransition><Image
            src={heroImage.url}
            alt={featuredProduct.title}
            fill
            sizes="(min-width: 1536px) 740px, (min-width: 1024px) 52vw, calc(100vw - 2rem)"
            loading="eager"
            fetchPriority="high"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          /></ProductImageTransition>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-16 text-white sm:px-8 sm:pb-7">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/75">Koleksiyondan</p>
            <div className="flex items-end justify-between gap-4">
              <p className="max-w-sm text-sm font-medium leading-5 text-balance sm:text-base">{featuredProduct.title}</p>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/40 bg-black/10 backdrop-blur-sm">
                <ArrowUpRightIcon className="size-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </ProductImageLink>
      ) : null}
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
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <Link
          href="/search"
          className="shrink-0 rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Tümünü Gör
        </Link>
      </div>
      <ProductGrid
        products={products}
        layout={fitsRow ? "grid" : "scroll"}
        className={fitsRow ? `${shelfWidth} ${compactColumns} gap-3 sm:gap-4` : undefined}
        imageSizes={products.length === 1
          ? "(min-width: 640px) 384px, calc(100vw - 2rem)"
          : fitsRow ? "(min-width: 1024px) 320px, (min-width: 640px) 224px, 50vw" : "(min-width: 1024px) 256px, (min-width: 640px) 224px, 72vw"}
        prioritizeFirst
      />
    </section>
  );
}
