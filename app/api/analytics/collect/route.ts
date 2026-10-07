import { api } from "@/convex/_generated/api";
import { ANALYTICS_CONSENT_COOKIE, hasValidAnalyticsConsentToken } from "@/lib/analytics-consent-server";
import { getAdminBackend } from "@/lib/admin/backend";
import { isSameOriginRequest } from "@/lib/admin/session";
import { readJsonLimited } from "@/lib/http/read-json-limited";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EVENT_TYPES = ["page_view", "product_view", "add_to_cart", "begin_checkout"] as const;
type EventType = (typeof EVENT_TYPES)[number];

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, maxLength);
  return cleaned || null;
}

function cleanRoute(value: unknown) {
  if (typeof value !== "string" || value.length > 200 || !value.startsWith("/") ||
    value.startsWith("//") || value.includes("?") || value.includes("#")) return null;
  if (/^\/(?:admin|account|api)(?:\/|$)/.test(value)) return null;
  return value;
}

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return response(403, { error: "İstek reddedildi." });
  if (request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1") {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const { adminSecret } = (() => {
    try { return getAdminBackend(); } catch { return { adminSecret: "" }; }
  })();
  const consentToken = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  if (!hasValidAnalyticsConsentToken(consentToken, adminSecret)) {
    return response(401, { error: "Analitik izni bulunamadı." });
  }

  const parsedBody = await readJsonLimited(request, 4_096);
  if (!parsedBody.ok) return response(parsedBody.reason === "too_large" ? 413 : 400, { error: "Analitik olayı geçersiz." });
  const body = parsedBody.value;
  if (!record(body) || typeof body.eventType !== "string" ||
    !EVENT_TYPES.includes(body.eventType as EventType) ||
    typeof body.visitorId !== "string" || !UUID_PATTERN.test(body.visitorId) ||
    typeof body.sessionId !== "string" || !UUID_PATTERN.test(body.sessionId)) {
    return response(400, { error: "Analitik olayı geçersiz." });
  }

  const route = cleanRoute(body.route);
  const source = cleanText(body.source, 100);
  const medium = cleanText(body.medium, 100);
  const campaign = cleanText(body.campaign, 120);
  if (!source || !medium) return response(400, { error: "Analitik kaynağı geçersiz." });

  try {
    const { client } = getAdminBackend();
    await client.mutation(api.analytics.recordEvent, {
      adminSecret,
      visitorId: body.visitorId,
      sessionId: body.sessionId,
      eventType: body.eventType as EventType,
      source,
      medium,
      ...(campaign ? { campaign } : {}),
      ...(route ? { route } : {}),
    });
    return response(202, { accepted: true });
  } catch {
    return response(503, { error: "Analitik kaydedilemedi." });
  }
}
