import { httpRouter } from "convex/server";
import { httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
const callbackBodyLimitBytes = 10_000;

async function readLimitedText(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) return { ok: false as const, reason: "invalid" as const };
    if (declaredLength > callbackBodyLimitBytes) return { ok: false as const, reason: "too_large" as const };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: true as const, text: "" };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > callbackBodyLimitBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false as const, reason: "too_large" as const };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true as const, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false as const, reason: "invalid" as const };
  }
}

auth.addHttpRoutes(http);

http.route({
  path: "/iyzico/checkout-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await readLimitedText(request);
    if (!rawBody.ok) return new Response("Invalid request", { status: rawBody.reason === "too_large" ? 413 : 400 });
    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
    let token: unknown;
    if (contentType.includes("application/json")) {
      let body: unknown;
      try { body = JSON.parse(rawBody.text) as unknown; } catch { return new Response("Invalid payment callback", { status: 400 }); }
      if (body && typeof body === "object" && "token" in body) token = body.token;
    } else {
      const body = new URLSearchParams(rawBody.text);
      token = body.get("token");
    }
    if (typeof token !== "string" || token.length < 8 || token.length > 255) {
      return new Response("Invalid payment callback", { status: 400 });
    }

    const result = await ctx.runAction(internal.checkoutPayments.processCallback, { token });
    const returnUrl = env.PAYMENT_RETURN_URL;
    if (!returnUrl) return new Response("Payment result received", { status: 200 });
    try {
      const destination = new URL("/checkout/result", returnUrl);
      destination.searchParams.set("status", result);
      return Response.redirect(destination.toString(), 303);
    } catch {
      return new Response("Payment result received", { status: 200 });
    }
  }),
});

http.route({
  path: "/paytr/callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return new Response("Unsupported content type", { status: 415 });
    }

    const rawBody = await readLimitedText(request);
    if (!rawBody.ok) return new Response("Invalid request", { status: rawBody.reason === "too_large" ? 413 : 400 });
    if (!rawBody.text) return new Response("Invalid callback", { status: 400 });
    const body = new URLSearchParams(rawBody.text);
    const field = (name: string, maxLength: number) => {
      const value = body.get(name);
      return value && value.length <= maxLength ? value : null;
    };
    const merchantOid = field("merchant_oid", 64);
    const status = field("status", 20);
    const totalAmount = field("total_amount", 12);
    const hash = field("hash", 128);
    if (!merchantOid || !/^[A-Za-z0-9]+$/.test(merchantOid) || !status ||
      !totalAmount || !/^\d+$/.test(totalAmount) || !hash) {
      return new Response("Invalid callback", { status: 400 });
    }

    try {
      const accepted = await ctx.runAction(internal.checkoutPayments.processPaytrCallback, {
        merchantOid,
        status,
        totalAmount,
        hash,
      });
      return accepted
        ? new Response("OK", { status: 200 })
        : new Response("Order not found", { status: 404 });
    } catch {
      return new Response("Invalid callback", { status: 400 });
    }
  }),
});

export default http;
