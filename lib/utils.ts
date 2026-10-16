import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ReadonlyURLSearchParams } from "next/navigation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SiteUrlSource {
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

/**
 * Tüm mutlak site adreslerinin tek kaynağı. Vercel, `VERCEL_PROJECT_PRODUCTION_URL`
 * değişkenini kendisi verdiği için env tanımlanmasa bile üretim domain'i bulunur.
 */
export function resolveBaseUrl(source: SiteUrlSource): string {
  const configured =
    source.NEXT_PUBLIC_SITE_URL?.trim() ||
    source.SITE_URL?.trim() ||
    source.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configured) return "http://localhost:3000";

  const withScheme = /^[a-z]+:\/\//i.test(configured) ? configured : `https://${configured}`;
  return withScheme.replace(/\/+$/, "");
}

export const baseUrl = resolveBaseUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SITE_URL: process.env.SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});

export const createUrl = (
  pathname: string,
  params: URLSearchParams | ReadonlyURLSearchParams,
) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`;

  return `${pathname}${queryString}`;
};
