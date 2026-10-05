import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ReadonlyURLSearchParams } from "next/navigation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? (process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : `https://${process.env.NEXT_PUBLIC_SITE_URL}`)
  : process.env.SITE_URL || "http://localhost:3000";

export const createUrl = (
  pathname: string,
  params: URLSearchParams | ReadonlyURLSearchParams,
) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`;

  return `${pathname}${queryString}`;
};
