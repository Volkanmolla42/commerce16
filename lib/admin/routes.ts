import { normalizeAdminPath } from "./path";

export function getServerAdminBasePath() {
  return `/${normalizeAdminPath(process.env.ADMIN_PATH || process.env.NEXT_PUBLIC_ADMIN_PATH)}`;
}

export const ADMIN_BASE_PATH = getServerAdminBasePath();

function getAdminBasePath() {
  if (typeof window !== "undefined") {
    const firstSegment = window.location.pathname.split("/")[1];
    if (firstSegment && firstSegment !== "admin" && firstSegment !== "api") {
      return `/${firstSegment}`;
    }
  }
  return getServerAdminBasePath();
}

const adminSegments: Record<string, string> = {
  orders: "siparisler",
  products: "urunler",
  inventory: "stok",
  categories: "kategoriler",
  questions: "sorular",
  customers: "musteriler",
  carts: "sepetler",
  coupons: "kuponlar",
  promotions: "kampanyalar",
  emails: "e-postalar",
  payments: "odemeler",
  analytics: "analitik",
  settings: "ayarlar",
  add: "ekle",
  import: "ice-aktar",
  edit: "duzenle",
};

function translateAdminPath(path: string) {
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
  const query = queryIndex >= 0 ? path.slice(queryIndex) : "";
  const translated = pathname
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => adminSegments[segment] ?? segment)
    .join("/");
  return `${translated}${query}`;
}

export function adminPath(path = "") {
  const base = getAdminBasePath();
  const suffix = translateAdminPath(path);
  return suffix ? `${base}/${suffix}` : base;
}
