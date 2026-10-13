/**
 * IBAN'ı boşluklardan arındırıp standart 4'lü bloklar halinde formatlar (örn: TR12 3456 7890 ...).
 */
export function formatIban(iban?: string | null): string {
  if (!iban) return "";
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Kullanıcı girdisindeki fazla boşlukları temizleyip tek boşluklu büyük harf IBAN formatına getirir.
 */
export function cleanIban(iban?: string | null): string {
  if (!iban) return "";
  return iban.trim().replace(/\s+/g, " ").toUpperCase();
}
