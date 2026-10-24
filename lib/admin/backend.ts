import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { cleanAdminErrorMessage } from "./error-message";

export function getAdminBackend() {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!adminSecret || adminSecret.length < 32) {
    throw new Error("ADMIN_API_SECRET en az 32 karakter olmalı ve Convex ile aynı ayarlanmalı.");
  }
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL veya CONVEX_URL ayarlanmamış.");
  return { adminSecret, client: new ConvexHttpClient(url, { logger: false }) };
}

function getAdminErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "İşlem tamamlanamadı.";

  const rawMessage = error.message.trim();
  const stackStart = rawMessage.search(/\s+at\s+[^()\r\n]+\([^\r\n)]*:\d+:\d+\)?/);
  const message = cleanAdminErrorMessage(stackStart >= 0 ? rawMessage.slice(0, stackStart) : rawMessage.split(/\r?\n\s*at\s+/)[0]);

  return message || "İşlem tamamlanamadı.";
}


export function adminErrorResponse(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = getAdminErrorMessage(error);
  const unavailable =
    rawMessage.includes("ADMIN_API_SECRET") ||
    rawMessage.includes("NEXT_PUBLIC_CONVEX_URL") ||
    rawMessage.includes("Yönetici işlemi doğrulanamadı");
  const status = unavailable ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}
