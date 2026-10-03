import Grid from "@/components/grid";
import ProductGridItems from "@/components/layout/product-grid-items";
import { defaultSort, sorting } from "@/lib/constants";
import { getProducts } from "@/lib/catalog";
import { Suspense } from "react";

export const metadata = {
  title: "Arama",
  description: "Mağazadaki ürünleri arayın.",
};

async function SearchContent(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const sort = (searchParams?.sort as string) || undefined;
  const searchValue = (searchParams?.q as string) || undefined;
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const products = await getProducts({ sortKey, reverse, query: searchValue });

  return (
    <>
      {searchValue ? (
        <p className="mb-4">
          {products.length === 0 ? (
            <>
              <span className="font-bold">&quot;{searchValue}&quot;</span> ile
              eşleşen ürün bulunamadı.
            </>
          ) : (
            <>
              <span className="font-bold">&quot;{searchValue}&quot;</span> için{" "}
              {products.length} sonuç gösteriliyor
            </>
          )}
        </p>
      ) : null}
      {products.length > 0 ? (
        <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ProductGridItems products={products} />
        </Grid>
      ) : null}
    </>
  );
}

export default function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={null}>
      <SearchContent searchParams={props.searchParams} />
    </Suspense>
  );
}
