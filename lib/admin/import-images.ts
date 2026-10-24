import sharp from "sharp";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { Id } from "@/convex/_generated/dataModel";

function ipv6Bytes(address: string): number[] | null {
  let host = address.split("%")[0]!.toLowerCase();
  if (host.includes(".")) {
    const lastColon = host.lastIndexOf(":");
    const ipv4 = host.slice(lastColon + 1).split(".").map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    host = `${host.slice(0, lastColon + 1)}${((ipv4[0]! << 8) | ipv4[1]!).toString(16)}:${((ipv4[2]! << 8) | ipv4[3]!).toString(16)}`;
  }
  const halves = host.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.flatMap((group) => {
    const value = parseInt(group, 16);
    return [value >> 8, value & 255];
  });
}

function isPrivateIpv6(address: string): boolean {
  const bytes = ipv6Bytes(address);
  if (!bytes) return true;

  const embeddedIpv4 = () => `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
  const isMapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (isMapped) return isPrivateAddress(embeddedIpv4());
  const isCompatible = bytes.slice(0, 12).every((byte) => byte === 0);
  if (isCompatible) return isPrivateAddress(embeddedIpv4());

  if (bytes.every((byte) => byte === 0)) return true;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return true;
  if ((bytes[0]! & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1]! & 0xc0) === 0x80) return true;
  if (bytes[0] === 0xff) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true;
  return false;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) === 6) return isPrivateIpv6(address);
  return false;
}

const hostResolutionCache = new Map<string, boolean>();

async function isPrivateHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host)) return isPrivateAddress(host);
  if (hostResolutionCache.has(host)) return hostResolutionCache.get(host)!;
  try {
    const addresses = await lookup(host, { all: true, order: "verbatim" });
    const isPrivate = addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address));
    hostResolutionCache.set(host, isPrivate);
    return isPrivate;
  } catch {
    return true;
  }
}

async function toWebp(
  buffer: Buffer,
  options: {
    width: number;
    height: number;
    fit: "inside" | "cover";
    quality: number;
    effort?: number;
    withoutEnlargement?: boolean;
  },
) {
  return await sharp(buffer)
    .resize({
      width: options.width,
      height: options.height,
      fit: options.fit,
      withoutEnlargement: options.withoutEnlargement,
    })
    .webp({ quality: options.quality, effort: options.effort })
    .toBuffer();
}

export async function optimizeImageBuffer(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await toWebp(buffer, {
      width: 1600,
      height: 1600,
      fit: "inside",
      quality: 80,
      effort: 3,
      withoutEnlargement: true,
    });
  } catch {
    return null;
  }
}

export async function imagePreviewDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const thumbnail = await toWebp(buffer, { width: 120, height: 120, fit: "cover", quality: 60 });
    return `data:image/webp;base64,${thumbnail.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function downloadAndOptimizeImage(url: string): Promise<Buffer | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (await isPrivateHost(parsed.hostname)) return null;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
      headers: { "User-Agent": "Commerce16-Importer/1.0" },
    });

    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const contentLength = Number(res.headers.get("content-length"));
    if (contentLength && contentLength > 10 * 1024 * 1024) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > 10 * 1024 * 1024) return null;

    return await optimizeImageBuffer(Buffer.from(arrayBuf));
  } catch {
    return null;
  }
}

export type StorageImageResult = {
  storageId: Id<"_storage">;
  fileName: string;
};
