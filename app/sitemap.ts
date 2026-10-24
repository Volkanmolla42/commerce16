import { routes } from "@/lib/storefront-routes";
import { getCategories, getSitemapProducts, getStoreSettings } from "@/lib/catalog";
import { getLegalDocuments } from "@/lib/legal-documents";
import { getSellerInfo } from "@/lib/store-config";
import { baseUrl } from "@/lib/utils";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  const [categories, products, settings] = await Promise.all([
    getCategories(),
    getSitemapProducts(),
    getStoreSettings(),
  ]);

  const categoryRoutes = categories
    .filter((category) => category.path !== routes.search)
    .map((category) => ({
      url: new URL(category.path, baseUrl).toString(),
      lastModified: category.updatedAt,
    }));

  const productRoutes = products.map((product) => ({
    url: new URL(routes.product(product.slug), baseUrl).toString(),
    lastModified: product.updatedAt,
  }));

  const legalReady = getLegalDocuments(getSellerInfo(settings)).refundPolicy.ready;
  const staticPageRoutes = [
    routes.about,
    ...(legalReady
      ? [routes.termsConditions, routes.privacyPolicy, routes.refundPolicy, routes.cookiePolicy]
      : []),
  ].map((path) => ({ url: new URL(path, baseUrl).toString() }));

  const entries = [
    { url: new URL(routes.home, baseUrl).toString() },
    ...categoryRoutes,
    ...productRoutes,
    ...staticPageRoutes,
  ];
  return [...new Map(entries.map((route) => [route.url, route])).values()];
}
