export function cleanAdminErrorMessage(raw: string): string {
  return raw
    .replace(/^\[Request ID:[^\]]+\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/^Uncaught (?:Convex)?Error:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
}
