import { createHmac } from "node:crypto";
import { getAdminBackend } from "@/lib/admin/backend";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { readJsonLimited } from "@/lib/http/read-json-limited";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  getAdminSessionToken,
  hasAdminSession,
  isAdminAuthConfigured,
  isSameOriginRequest,
  isValidAdminPin,
} from "@/lib/admin/session";

function authResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function getAttemptKey(request: NextRequest, secret: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp =
    request.headers.get("x-real-ip")?.trim() ||
    forwardedFor?.split(",")[0]?.trim() ||
    "unknown";

  return createHmac("sha256", secret)
    .update(`commerce-admin-pin-attempt:${clientIp}`)
    .digest("hex");
}

export async function GET() {
  return authResponse({ authenticated: await hasAdminSession() });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return authResponse({ success: false, error: "İstek reddedildi." }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return authResponse(
      {
        success: false,
        error: "6 haneli ADMIN_PIN, ADMIN_API_SECRET ve NEXT_PUBLIC_CONVEX_URL ayarlarını tamamla.",
      },
      { status: 503 },
    );
  }

  try {
    const parsedBody = await readJsonLimited(req, 4_096);
    if (!parsedBody.ok) {
      return authResponse(
        { success: false, error: parsedBody.reason === "too_large" ? "İstek çok büyük." : "İstek gövdesi geçersiz." },
        { status: parsedBody.reason === "too_large" ? 413 : 400 },
      );
    }
    const body = parsedBody.value;
    const pin = body && typeof body === "object" && "pin" in body
      ? body.pin
      : undefined;
    const { adminSecret: secret, client } = getAdminBackend();
    const key = getAttemptKey(req, secret);
    const attempt = await client.mutation(api.adminAuth.consumePinAttempt, {
      adminSecret: secret,
      key,
    });

    if (!attempt.ok) {
      const retryAfter = Math.max(1, Math.ceil((attempt.retryAfter ?? 0) / 1000));
      return authResponse(
        { success: false, error: `Çok fazla hatalı deneme. ${retryAfter} saniye sonra tekrar dene.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    if (!isValidAdminPin(pin)) {
      return authResponse(
        { success: false, error: "Yönetici PIN'i hatalı." },
        { status: 401 },
      );
    }

    await client.mutation(api.adminAuth.resetPinAttempts, { adminSecret: secret, key });
    const cookieStore = await cookies();

    cookieStore.set(ADMIN_COOKIE_NAME, getAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return authResponse({ success: true });
  } catch {
    return authResponse(
      { success: false, error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return authResponse({ success: false, error: "İstek reddedildi." }, { status: 403 });
  }
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return authResponse({ success: true });
}
