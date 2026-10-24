import { cookies } from "next/headers";
import { connection } from "next/server";
import { hmacSha256, safeEqual } from "../crypto";

export const ADMIN_COOKIE_NAME = "commerce_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function adminPin() {
  return process.env.ADMIN_PIN || "";
}

function adminApiSecret() {
  return process.env.ADMIN_API_SECRET || "";
}

export function isAdminAuthConfigured() {
  return (
    /^\d{6}$/.test(adminPin()) &&
    adminApiSecret().length >= 32 &&
    Boolean(process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL)
  );
}

function signAdminSession(expiresAt: number) {
  return hmacSha256(adminApiSecret(), `commerce-admin-session:v1:${adminPin()}:${expiresAt}`);
}

export function getAdminSessionToken(now = Date.now()) {
  if (!isAdminAuthConfigured()) {
    throw new Error(
      "6 haneli ADMIN_PIN, ADMIN_API_SECRET ve NEXT_PUBLIC_CONVEX_URL ayarlanmalı.",
    );
  }
  const expiresAt = now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  return `v1.${expiresAt}.${signAdminSession(expiresAt)}`;
}

function isValidAdminSessionToken(value: string, now = Date.now()) {
  const [version, expiresAtValue, signature, ...extra] = value.split(".");
  const expiresAt = Number(expiresAtValue);
  if (version !== "v1" || extra.length > 0 || !/^\d{13}$/.test(expiresAtValue ?? "") ||
    !Number.isSafeInteger(expiresAt) || expiresAt <= now ||
    expiresAt > now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000 + 60_000 ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")) return false;
  return safeEqual(signature, signAdminSession(expiresAt));
}

export function isValidAdminPin(value: unknown) {
  return (
    isAdminAuthConfigured() &&
    typeof value === "string" &&
    /^\d{6}$/.test(value) &&
    safeEqual(value, adminPin())
  );
}

export async function hasAdminSession() {
  await connection();
  if (!isAdminAuthConfigured()) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(session && isValidAdminSessionToken(session));
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
