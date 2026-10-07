import { api } from "@/convex/_generated/api";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_MAX_AGE_SECONDS, createAnalyticsConsentToken } from "@/lib/analytics-consent-server";
import { getAdminBackend } from "@/lib/admin/backend";
import { isSameOriginRequest } from "@/lib/admin/session";
import { readJsonLimited } from "@/lib/http/read-json-limited";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function unavailableResponse() {
  return NextResponse.json(
    { error: "Analitik hizmeti yapılandırılmamış." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "İstek reddedildi." }, { status: 403 });
  }

  const privacySignal = request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1";
  if (privacySignal) {
    const response = NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.delete(ANALYTICS_CONSENT_COOKIE);
    return response;
  }

  const parsedBody = await readJsonLimited(request, 2_048);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: "Analitik tercihi geçersiz." },
      { status: parsedBody.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body = parsedBody.value;
  if (!body || typeof body !== "object" || !("analytics" in body) || body.analytics !== true) {
    return NextResponse.json({ error: "Analitik izni bulunamadı." }, { status: 403 });
  }

  try {
    const { adminSecret } = getAdminBackend();
    const response = NextResponse.json({ enabled: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(ANALYTICS_CONSENT_COOKIE, createAnalyticsConsentToken(adminSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ANALYTICS_CONSENT_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return unavailableResponse();
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "İstek reddedildi." }, { status: 403 });
  }

  const response = NextResponse.json({ erasureScheduled: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.delete(ANALYTICS_CONSENT_COOKIE);

  const parsedBody = await readJsonLimited(request, 2_048);
  if (!parsedBody.ok) {
    const failed = NextResponse.json(
      { error: "Silme isteği geçersiz." },
      { status: parsedBody.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
    );
    failed.cookies.delete(ANALYTICS_CONSENT_COOKIE);
    return failed;
  }

  try {
    const body = parsedBody.value;
    if (body && typeof body === "object" && "visitorId" in body &&
      typeof body.visitorId === "string" && UUID_PATTERN.test(body.visitorId)) {
      const { adminSecret, client } = getAdminBackend();
      await client.mutation(api.analytics.eraseVisitorData, {
        adminSecret,
        visitorId: body.visitorId,
      });
    }
    return response;
  } catch {
    const failed = unavailableResponse();
    failed.cookies.delete(ANALYTICS_CONSENT_COOKIE);
    return failed;
  }
}
