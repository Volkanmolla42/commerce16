import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "commerce_admin_session";

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
    Boolean(process.env.NEXT_PUBLIC_CONVEX_URL)
  );
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getAdminSessionToken() {
  if (!isAdminAuthConfigured()) {
    throw new Error(
      "6 haneli ADMIN_PIN, ADMIN_API_SECRET ve NEXT_PUBLIC_CONVEX_URL ayarlanmalı.",
    );
  }
  return createHmac("sha256", adminApiSecret())
    .update(`commerce-admin-session:${adminPin()}`)
    .digest("hex");
}

export function isValidAdminPin(value: unknown) {
  return (
    isAdminAuthConfigured() &&
    typeof value === "string" &&
    /^\d{6}$/.test(value) &&
    constantTimeEqual(value, adminPin())
  );
}

export async function hasAdminSession() {
  if (!isAdminAuthConfigured()) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(
    session && constantTimeEqual(session, getAdminSessionToken())
  );
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
