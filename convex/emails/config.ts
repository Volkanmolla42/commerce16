import { env } from "../_generated/server";
import { normalizeAdminPath } from "../../lib/admin/path";

/**
 * E-posta yapılandırması eksikse uydurma bir değer üretilmez: ilgili alan boş
 * döner ve gönderim kapısı ("not_configured") maili hiç göndermez.
 */

/** Gönderim yapılabilmesi için sağlayıcı anahtarı ve bağlantıların tabanı şart. */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && siteUrl());
}

/** Gönderen başlığı: "Mağaza Adı <info@magaza.com>". ORDER_FROM_EMAIL tanımsızsa boş. */
export function senderAddress(storeName: string): string {
  const email = env.ORDER_FROM_EMAIL?.trim() ?? "";
  if (!email) return "";
  if (email.includes("<")) return email;
  const name = storeName.trim();
  return name ? `${name} <${email}>` : email;
}

/** Yönetici bildirimlerinin alıcısı. ADMIN_ALERT_EMAIL tanımsızsa boş. */
export function adminAlertTo(): string {
  return env.ADMIN_ALERT_EMAIL?.trim() ?? "";
}

/** E-postalardaki tüm bağlantıların tabanı. SITE_URL tanımsızsa boş. */
export function siteUrl(): string {
  return (env.SITE_URL?.trim() ?? "").replace(/\/+$/, "");
}

export function siteLink(path: string, params?: Record<string, string>): string {
  const base = siteUrl();
  if (!base) return "";

  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/** proxy.ts "/admin" isteğini engeller; admin bağlantıları gizli kök yolundan kurulur. */
export function adminLink(path = ""): string {
  const base = `/${normalizeAdminPath(env.ADMIN_PATH)}`;
  return siteLink(path ? `${base}/${path.replace(/^\/+/, "")}` : base);
}
