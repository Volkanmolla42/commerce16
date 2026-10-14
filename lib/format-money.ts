const STORE_CURRENCY = "TRY";

export function formatMoney(amount: number | string, currency = STORE_CURRENCY) {
  const value = typeof amount === "number" ? amount : Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;
  // Kuruş yoksa ondalık gösterme ("888 TL"), varsa iki hane ("888,50 TL").
  const fractionDigits = Number.isInteger(safeValue) ? 0 : 2;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safeValue);
  return `${formatted} ${currency === "TRY" ? "TL" : currency}`;
}

/**
 * Kuruş cinsinden tam sayıyı ondalıklı TL stringine çevirir (örn: 1550 -> "15.50").
 */
export function kurusToLira(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined || !Number.isFinite(kurus)) return "0.00";
  return (kurus / 100).toFixed(2);
}

/**
 * TL tutarını (string veya number) kuruş tam sayısına çevirir (örn: "15.50" veya "15,50" -> 1550).
 */
export function toKurus(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const str = String(amount).trim().replace(",", ".");
  if (!str) return 0;
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}
