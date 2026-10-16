
export function formatIban(iban?: string | null): string {
  if (!iban) return "";
  const cleaned = iban.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!cleaned) return "";

  const digits = cleaned.startsWith("TR")
    ? cleaned.slice(2).replace(/[^0-9]/g, "")
    : cleaned.replace(/[^0-9]/g, "");

  const full = ("TR" + digits).slice(0, 26);
  return full.replace(/(.{4})/g, "$1 ").trim();
}
