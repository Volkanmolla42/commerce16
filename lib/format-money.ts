export const STORE_CURRENCY = "TRY";

export function formatMoney(amount: number | string, currency = STORE_CURRENCY) {
  const value = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(Number.isFinite(value) ? value : 0);
}
