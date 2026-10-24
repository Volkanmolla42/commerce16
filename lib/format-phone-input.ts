import { turkishPhoneDigits } from "./phone";

export function formatPhoneInput(value: string): string {
  const digits = turkishPhoneDigits(value);
  if (!digits) return "";

  const rest = [digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean);
  return `0${digits.slice(0, 3)}${rest.length ? ` ${rest.join(" ")}` : ""}`;
}
