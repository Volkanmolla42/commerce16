const DEFAULT_ADMIN_PATH = "yonetim23";

export function normalizeAdminPath(value: string | undefined) {
  const segment = value?.trim().replace(/^\/+|\/+$/g, "");
  return segment && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(segment) && segment !== "admin"
    ? segment
    : DEFAULT_ADMIN_PATH;
}
