import { ConvexHttpClient } from "convex/browser";

export function getAdminBackend() {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!adminSecret || adminSecret.length < 32) {
    throw new Error("ADMIN_API_SECRET en az 32 karakter olmalı ve Convex ile aynı ayarlanmalı.");
  }
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL ayarlanmamış.");
  return { adminSecret, client: new ConvexHttpClient(url, { logger: false }) };
}
