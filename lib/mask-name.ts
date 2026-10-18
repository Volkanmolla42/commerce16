export function maskName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part[0]?.toLocaleUpperCase("tr-TR")}**`)
    .join(" ");
}
