import { getCategories, getSitemapProducts } from "@/lib/catalog";
import { baseUrl } from "@/lib/utils";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  const routesMap = [{ url: new URL("/", baseUrl).toString() }];

  const categoriesPromise = getCategories().then((categories) =>
    categories.filter((category) => category.path !== "/search").map((category) => ({
      url: new URL(category.path, baseUrl).toString(),
      lastModified: category.updatedAt,
    })),
  );

  const productsPromise = getSitemapProducts().then((products) =>
    products.map((product) => ({
      url: new URL(`/product/${product.slug}`, baseUrl).toString(),
      lastModified: product.updatedAt,
    })),
  );

  const staticPageRoutes = ["about", "terms-conditions", "privacy-policy"]
    .map((slug) => ({ url: new URL(`/${slug}`, baseUrl).toString() }));

  const fetchedRoutes = (await Promise.all([categoriesPromise, productsPromise])).flat();
  return [...new Map([...routesMap, ...fetchedRoutes, ...staticPageRoutes].map((route) => [route.url, route])).values()];
}
