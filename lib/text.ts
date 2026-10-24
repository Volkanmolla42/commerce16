export function normalizeTurkishText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function slugify(value: string) {
  return normalizeTurkishText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSearchText(value: string) {
  return normalizeTurkishText(value)
    .replace(/\bt[-\s]+shirt\b/g, "tshirt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeHeaderKey(value: string) {
  return normalizeTurkishText(value).replace(/[^a-z0-9]/g, "");
}
