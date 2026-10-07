import {
  BeakerIcon,
  DevicePhoneMobileIcon,
  GiftIcon,
  HomeIcon,
  ShoppingBagIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import type { Category, Product } from "@/lib/catalog/types";
import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";

function CategoryIcon({ category }: { category: Category }) {
  const label = `${category.slug} ${category.title}`.toLocaleLowerCase("tr-TR");

  if (label.includes("giyim") || label.includes("kıyafet")) return <ShoppingBagIcon aria-hidden="true" className="h-6 w-6" />;
  if (label.includes("ayakkabı")) return <ShoppingBagIcon aria-hidden="true" className="h-6 w-6" />;
  if (label.includes("aksesuar")) return <GiftIcon aria-hidden="true" className="h-6 w-6" />;
  if (label.includes("ev") || label.includes("yaşam")) return <HomeIcon aria-hidden="true" className="h-6 w-6" />;
  if (label.includes("elektronik")) return <DevicePhoneMobileIcon aria-hidden="true" className="h-6 w-6" />;
  if (label.includes("kupa") || label.includes("fincan")) return <BeakerIcon aria-hidden="true" className="h-6 w-6" />;
  return <TagIcon aria-hidden="true" className="h-6 w-6" />;
}

export function CategoryShortcuts({ categories }: { categories: Category[] }) {
  const visibleCategories = categories.filter((category) => category.slug !== "");
  if (visibleCategories.length === 0) return null;

  return (
    <nav aria-label="Kategoriler" className="border-b border-border py-3 sm:py-4">
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] sm:justify-center sm:gap-5">
        {visibleCategories.map((category) => (
          <li key={category.slug} className="w-[4.5rem] shrink-0 snap-start sm:w-20">
            <Link
              href={category.path}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-1 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="relative grid size-12 place-items-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/15 sm:size-14">
                {category.imageUrl ? (
                  <Image src={category.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  <CategoryIcon category={category} />
                )}
              </span>
              <span className="line-clamp-2 leading-3.5">{category.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
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
  const shelfWidth = fitsRow ? "mx-auto max-w-5xl" : "";

  return (
    <section className="border-b border-border py-7 sm:py-9" aria-label={title}>
      <div className={`${shelfWidth} mb-4 flex items-center justify-between gap-4 sm:mb-5`}>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        <Link
          href="/search"
          className="shrink-0 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Tümünü gör
        </Link>
      </div>
      <Grid className={fitsRow
        ? `${shelfWidth} ${compactColumns} gap-3 sm:gap-4`
        : "grid-flow-col auto-cols-[minmax(11rem,72vw)] gap-3 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [&>*]:[scroll-snap-align:start] sm:auto-cols-[14rem] sm:gap-4 lg:auto-cols-[16rem]"}>
        <ProductGridItems
          products={products}
          imageSizes={fitsRow ? "(min-width: 1024px) 320px, (min-width: 640px) 224px, 50vw" : "(min-width: 1024px) 256px, (min-width: 640px) 224px, 72vw"}
          prioritizeFirst
          cardLayout="stacked"
          imageFit="cover"
        />
      </Grid>
    </section>
  );
}
