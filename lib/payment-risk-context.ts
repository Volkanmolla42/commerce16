export type SignedCheckoutRiskContext = {
  ipAddress: string;
  issuedAt: number;
  signature: string;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signCheckoutRiskContext(ipAddress: string, secret: string): Promise<SignedCheckoutRiskContext> {
  const issuedAt = Date.now();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ipAddress}\n${issuedAt}`),
  );
  return { ipAddress, issuedAt, signature: toHex(new Uint8Array(signature)) };
}
