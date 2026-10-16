import { normalizeAdminPath } from "./path";

export function getServerAdminBasePath() {
  return `/${normalizeAdminPath(process.env.ADMIN_PATH || process.env.NEXT_PUBLIC_ADMIN_PATH)}`;
}

export const ADMIN_BASE_PATH = getServerAdminBasePath();

export function getAdminBasePath() {
  if (typeof window !== "undefined") {
    const firstSegment = window.location.pathname.split("/")[1];
    if (firstSegment && firstSegment !== "admin" && firstSegment !== "api") {
      return `/${firstSegment}`;
    }
  }
  return getServerAdminBasePath();
}

export function adminPath(path = "") {
  const base = getAdminBasePath();
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${base}/${suffix}` : base;
}
