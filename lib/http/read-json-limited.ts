type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid" };

export async function readJsonLimited(request: Request, maxBytes: number): Promise<LimitedJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("JSON body limit must be a positive integer.");

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) return { ok: false, reason: "invalid" };
    if (declaredLength > maxBytes) return { ok: false, reason: "too_large" };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: true, value: null };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: text.trim() ? JSON.parse(text) as unknown : null };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
