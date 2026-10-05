import { getCategories, getPages, getProducts } from "@/lib/catalog";
import { baseUrl } from "@/lib/utils";
import { MetadataRoute } from "next";

type Route = {
  url: string;
  lastModified: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  const routesMap = ["", "/search"].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
  }));

  const categoriesPromise = getCategories().then((categories) =>
    categories.map((category) => ({
      url: `${baseUrl}${category.path}`,
      lastModified: category.updatedAt,
    })),
  );

  const productsPromise = getProducts({}).then((products) =>
    products.map((product) => ({
      url: `${baseUrl}/product/${product.slug}`,
      lastModified: product.updatedAt,
    })),
  );

  const pagesPromise = getPages().then((pages) =>
    pages.map((page) => ({
      url: `${baseUrl}/${page.slug}`,
      lastModified: page.updatedAt,
    })),
  );

  let fetchedRoutes: Route[] = [];

  try {
    fetchedRoutes = (
      await Promise.all([categoriesPromise, productsPromise, pagesPromise])
    ).flat();
  } catch (error) {
    throw JSON.stringify(error, null, 2);
  }

  return [...routesMap, ...fetchedRoutes];
}
