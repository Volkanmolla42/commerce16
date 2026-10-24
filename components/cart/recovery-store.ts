const CART_RECOVERY_SESSION_KEY = "commerce_cart_recovery_v1";

export function getCartRecoverySessionKey(createIfMissing = true) {
  const existing = window.localStorage.getItem(CART_RECOVERY_SESSION_KEY);
  if (existing && /^[a-f0-9-]{32,64}$/i.test(existing)) return existing;
  if (!createIfMissing) return null;

  const sessionKey = window.crypto.randomUUID();
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
