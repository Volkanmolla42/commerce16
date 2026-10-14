/**
 * Telefon girişini yazarken "05XX XXX XX XX" düzenine göre biçimlendirir.
 * Alan kodu korunur; +90 ile başlayan değerler ulusal biçime indirilir.
 */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return "";

  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  const area = national.slice(0, 3);
  const rest = [national.slice(3, 6), national.slice(6, 8), national.slice(8, 10)].filter(Boolean);
  return `0${area}${rest.length ? ` ${rest.join(" ")}` : ""}`;
}
