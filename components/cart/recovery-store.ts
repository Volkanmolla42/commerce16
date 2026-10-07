const CART_RECOVERY_SESSION_KEY = "commerce_cart_recovery_v1";

export function getCartRecoverySessionKey(createIfMissing = true) {
  const existing = window.localStorage.getItem(CART_RECOVERY_SESSION_KEY);
  if (existing && /^[a-f0-9-]{32,64}$/i.test(existing)) return existing;
  if (!createIfMissing) return null;

  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const sessionKey = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(CART_RECOVERY_SESSION_KEY, sessionKey);
  return sessionKey;
}

export function clearCartRecoverySessionKey() {
  window.localStorage.removeItem(CART_RECOVERY_SESSION_KEY);
}

export function setCartRecoverySessionKey(sessionKey: string) {
  if (!/^[a-f0-9-]{32,64}$/i.test(sessionKey)) return;
  window.localStorage.setItem(CART_RECOVERY_SESSION_KEY, sessionKey);
}
