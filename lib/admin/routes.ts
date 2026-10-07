const DEFAULT_ADMIN_PATH = "yonetim23";

function normalizeAdminPath(value: string | undefined) {
  const segment = value?.trim().replace(/^\/+|\/+$/g, "");
  return segment && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(segment) && segment !== "admin"
    ? segment
    : DEFAULT_ADMIN_PATH;
}

export const ADMIN_BASE_PATH = `/${normalizeAdminPath(process.env.NEXT_PUBLIC_ADMIN_PATH)}`;

export function adminPath(path = "") {
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${ADMIN_BASE_PATH}/${suffix}` : ADMIN_BASE_PATH;
}
