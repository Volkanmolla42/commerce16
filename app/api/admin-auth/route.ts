import { createHmac } from "node:crypto";
import { getAdminBackend } from "@/lib/admin/backend";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  ADMIN_COOKIE_NAME,
  getAdminSessionToken,
  hasAdminSession,
  isAdminAuthConfigured,
  isSameOriginRequest,
  isValidAdminPin,
} from "@/lib/admin/session";

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
  return NextResponse.json({ authenticated: await hasAdminSession() });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ success: false, error: "İstek reddedildi." }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "6 haneli ADMIN_PIN, ADMIN_API_SECRET ve NEXT_PUBLIC_CONVEX_URL ayarlarını tamamla.",
      },
      { status: 503 },
    );
  }

  try {
    const body: unknown = await req.json();
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
      return NextResponse.json(
        { success: false, error: `Çok fazla hatalı deneme. ${retryAfter} saniye sonra tekrar dene.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    if (!isValidAdminPin(pin)) {
      return NextResponse.json(
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
      maxAge: 60 * 60 * 24 * 7, // 7 gün
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası oluştu." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: "İstek reddedildi." }, { status: 403 });
  }
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
