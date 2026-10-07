import { internal } from "./_generated/api";
import { env, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import schema from "./schema";
import { v } from "convex/values";

const tokenRecordValidator = schema.doc("providerTokens");
const refreshClaimValidator = v.union(
  v.object({ kind: v.literal("ready"), encryptedAccessToken: v.string() }),
  v.object({ kind: v.literal("busy") }),
  v.object({ kind: v.literal("refresh"), encryptedRefreshToken: v.string() }),
  v.object({ kind: v.literal("missing") }),
);

export type ParasutConfig = { clientId: string; clientSecret: string; companyId: string };

export class ParasutHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ParasutHttpError";
  }
}

export function parasutConfig(): ParasutConfig | null {
  const clientId = env.PARASUT_CLIENT_ID?.trim();
  const clientSecret = env.PARASUT_CLIENT_SECRET?.trim();
  const companyId = env.PARASUT_COMPANY_ID?.trim();
  const encryptionKey = env.PARASUT_TOKEN_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !companyId || !/^\d+$/.test(companyId) || !/^[\da-f]{64}$/i.test(encryptionKey ?? "")) {
    return null;
  }
  return { clientId, clientSecret, companyId };
}

function keyBytes() {
  const value = env.PARASUT_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[\da-f]{64}$/i.test(value)) throw new Error("Paraşüt OAuth token şifreleme anahtarı yapılandırılmamış.");
  return Uint8Array.from(value.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^(?:[\da-f]{2})+$/i.test(value)) throw new Error("Şifreli Paraşüt token kaydı bozuk.");
  return Uint8Array.from(value.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}

async function encryptToken(value: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes(), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${toHex(iv)}.${toHex(new Uint8Array(ciphertext))}`;
}

async function decryptToken(value: string) {
  const [ivHex, ciphertextHex, extra] = value.split(".");
  if (!ivHex || !ciphertextHex || extra) throw new Error("Şifreli Paraşüt token kaydı bozuk.");
  const key = await crypto.subtle.importKey("raw", keyBytes(), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(ivHex) },
    key,
    fromHex(ciphertextHex),
  );
  return new TextDecoder().decode(plaintext);
}

export const getStoredTokens = internalQuery({
  args: {},
  returns: v.union(tokenRecordValidator, v.null()),
  handler: async (ctx) => await ctx.db.query("providerTokens").withIndex("by_provider", (q) => q.eq("provider", "parasut")).first(),
});

export const claimTokenRefresh = internalMutation({
  args: { encryptedBootstrapToken: v.optional(v.string()), leaseId: v.string() },
  returns: refreshClaimValidator,
  handler: async (ctx, { encryptedBootstrapToken, leaseId }) => {
    const now = Date.now();
    const existing = await ctx.db.query("providerTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "parasut"))
      .first();
    if (existing?.encryptedAccessToken && (existing.accessTokenExpiresAt ?? 0) > now + 60_000) {
      return { kind: "ready" as const, encryptedAccessToken: existing.encryptedAccessToken };
    }
    if (existing?.refreshLeaseUntil && existing.refreshLeaseUntil > now) return { kind: "busy" as const };
    if (existing) {
      await ctx.db.patch(existing._id, { refreshLeaseUntil: now + 45_000, refreshLeaseId: leaseId, updatedAt: now });
      return { kind: "refresh" as const, encryptedRefreshToken: existing.encryptedRefreshToken };
    }
    if (!encryptedBootstrapToken) return { kind: "missing" as const };
    await ctx.db.insert("providerTokens", {
      provider: "parasut",
      encryptedRefreshToken: encryptedBootstrapToken,
      refreshLeaseUntil: now + 45_000,
      refreshLeaseId: leaseId,
      updatedAt: now,
    });
    return { kind: "refresh" as const, encryptedRefreshToken: encryptedBootstrapToken };
  },
});

export const saveTokens = internalMutation({
  args: {
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.string(),
    accessTokenExpiresAt: v.number(),
    leaseId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db.query("providerTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "parasut"))
      .first();
    const updatedAt = Date.now();
    if (!tokenRecord || tokenRecord.refreshLeaseId !== args.leaseId) return false;
    await ctx.db.patch(tokenRecord._id, {
      encryptedAccessToken: args.encryptedAccessToken,
      encryptedRefreshToken: args.encryptedRefreshToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      refreshLeaseUntil: undefined,
      refreshLeaseId: undefined,
      updatedAt,
    });
    return true;
  },
});

export const releaseTokenRefresh = internalMutation({
  args: { leaseId: v.string() },
  returns: v.null(),
  handler: async (ctx, { leaseId }) => {
    const tokenRecord = await ctx.db.query("providerTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "parasut"))
      .first();
    if (tokenRecord?.refreshLeaseId === leaseId) {
      await ctx.db.patch(tokenRecord._id, { refreshLeaseUntil: undefined, refreshLeaseId: undefined, updatedAt: Date.now() });
    }
    return null;
  },
});

export const reserveApiRequestSlot = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const tokenRecord = await ctx.db.query("providerTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "parasut"))
      .first();
    if (!tokenRecord) throw new Error("Paraşüt token kaydı bulunamadı.");
    const requestAt = Math.max(Date.now(), tokenRecord.nextRequestAt ?? 0);
    await ctx.db.patch(tokenRecord._id, { nextRequestAt: requestAt + 1_050, updatedAt: Date.now() });
    return requestAt;
  },
});

export async function getParasutAccessToken(ctx: ActionCtx) {
  const config = parasutConfig();
  if (!config) throw new Error("Paraşüt OAuth bilgileri veya token şifreleme anahtarı eksik.");

  const bootstrapToken = env.PARASUT_INITIAL_REFRESH_TOKEN?.trim();
  const encryptedBootstrapToken = bootstrapToken ? await encryptToken(bootstrapToken) : undefined;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const leaseId = crypto.randomUUID();
    const claim = await ctx.runMutation(internal.parasut.claimTokenRefresh, { encryptedBootstrapToken, leaseId });
    if (claim.kind === "ready") return await decryptToken(claim.encryptedAccessToken);
    if (claim.kind === "missing") throw new Error("Paraşüt ilk refresh token'ı tanımlanmamış.");
    if (claim.kind === "busy") {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    try {
      const refreshToken = await decryptToken(claim.encryptedRefreshToken);
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      });
      const response = await fetch("https://api.parasut.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object") {
        throw new Error(`Paraşüt OAuth token yenileme isteği HTTP ${response.status} döndürdü.`);
      }
      const tokenResult = result as Record<string, unknown>;
      if (typeof tokenResult.access_token !== "string" || typeof tokenResult.refresh_token !== "string") {
        throw new Error("Paraşüt OAuth yanıtında erişim veya yenileme token'ı eksik.");
      }
      const expiresIn = typeof tokenResult.expires_in === "number" ? tokenResult.expires_in : 7200;
      const saved = await ctx.runMutation(internal.parasut.saveTokens, {
        encryptedAccessToken: await encryptToken(tokenResult.access_token),
        encryptedRefreshToken: await encryptToken(tokenResult.refresh_token),
        accessTokenExpiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
        leaseId,
      });
      if (!saved) throw new Error("Paraşüt token yenileme kilidi süresi doldu.");
      return tokenResult.access_token;
    } catch (cause) {
      await ctx.runMutation(internal.parasut.releaseTokenRefresh, { leaseId });
      throw cause;
    }
  }
  throw new Error("Paraşüt token yenilemesi başka bir işlemde; kısa süre sonra tekrar deneyin.");
}

function apiErrorMessage(body: unknown) {
  if (body && typeof body === "object" && "errors" in body && Array.isArray((body as { errors?: unknown }).errors)) {
    const messages = (body as { errors: unknown[] }).errors.slice(0, 3).map((error) => {
      if (!error || typeof error !== "object") return "";
      const record = error as Record<string, unknown>;
      return [record.title, record.detail].filter((part): part is string => typeof part === "string").join(": ");
    }).filter(Boolean);
    if (messages.length) return messages.join(" · ").slice(0, 300);
  }
  return "API yanıtı işlenemedi.";
}

export async function parasutRequest(ctx: ActionCtx, accessToken: string, path: string, init: RequestInit = {}) {
  const config = parasutConfig();
  if (!config) throw new Error("Paraşüt API bilgileri yapılandırılmamış.");
  const requestAt = await ctx.runMutation(internal.parasut.reserveApiRequestSlot, {});
  const delay = Math.max(0, requestAt - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`https://api.parasut.com/v4/${config.companyId}/${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ParasutHttpError(`Paraşüt API ${response.status}: ${apiErrorMessage(body)}`, response.status);
  if (!body || typeof body !== "object") throw new Error("Paraşüt API geçerli JSON yanıtı döndürmedi.");
  return body as Record<string, unknown>;
}
