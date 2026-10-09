export type CategoryAttributeType = "text" | "number" | "select" | "multiselect" | "boolean";

export type CategoryAttributeDefinition = {
  key: string;
  label: string;
  type: CategoryAttributeType;
  unit?: string;
  options?: string[];
  required: boolean;
};

export type CategoryAttributeTemplate = Omit<CategoryAttributeDefinition, "key">;

export const CATEGORY_ATTRIBUTE_LIMIT = 30;
export const ATTRIBUTE_OPTION_LIMIT = 100;
export const ATTRIBUTE_TYPES: Record<CategoryAttributeType, string> = {
  text: "Metin", number: "Sayı", select: "Tekli seçim",
  multiselect: "Çoklu seçim", boolean: "Evet / Hayır",
};

export function normalizeAttributeLabel(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function isChoiceAttribute(type: CategoryAttributeType) {
  return type === "select" || type === "multiselect";
}

/** The same rules apply to category fields and reusable library templates. */
export function parseAttributeTemplate(input: Record<string, unknown>): CategoryAttributeTemplate {
  if (typeof input.label !== "string" || !input.label.trim() || input.label.trim().length > 80) {
    throw new Error("Özellik adı 1-80 karakter olmalı.");
  }
  const type = input.type;
  if (typeof type !== "string" || !Object.hasOwn(ATTRIBUTE_TYPES, type)) {
    throw new Error("Kategori özellik türü geçersiz.");
  }
  if (typeof input.required !== "boolean") throw new Error("Zorunlu alan seçimi geçersiz.");
  if (input.unit !== undefined && typeof input.unit !== "string") throw new Error("Ölçü birimi geçersiz.");
  const unit = typeof input.unit === "string" ? input.unit.trim() : "";
  if (unit && (type !== "number" || unit.length > 20)) {
    throw new Error("Ölçü birimi yalnızca sayısal özelliklerde, en fazla 20 karakter olabilir.");
  }
  if (input.options !== undefined && (!Array.isArray(input.options) || input.options.some((option) => typeof option !== "string"))) {
    throw new Error("Özellik seçenekleri geçersiz.");
  }
  const options = ((input.options ?? []) as string[]).map((option) => option.trim());
  if (options.length > ATTRIBUTE_OPTION_LIMIT || options.some((option) => !option)) {
    throw new Error(`En fazla ${ATTRIBUTE_OPTION_LIMIT} seçenek girilebilir; seçenekler boş olamaz.`);
  }
  const choice = isChoiceAttribute(type as CategoryAttributeType);
  if (choice && !options.length) throw new Error("Seçim listeleri için en az bir seçenek girin.");
  if (!choice && options.length) throw new Error("Seçenekler yalnızca seçim listelerinde kullanılabilir.");
  if (new Set(options.map(normalizeAttributeLabel)).size !== options.length) {
    throw new Error("Özellik seçenekleri birbirinden farklı olmalı.");
  }
  return {
    label: input.label.trim(), type: type as CategoryAttributeType, required: input.required,
    ...(unit ? { unit } : {}), ...(choice ? { options } : {}),
  };
}

export function parseCategoryAttributes(value: unknown): CategoryAttributeDefinition[] {
  if (!Array.isArray(value) || value.length > CATEGORY_ATTRIBUTE_LIMIT) {
    throw new Error(`Kategoriye en fazla ${CATEGORY_ATTRIBUTE_LIMIT} özellik eklenebilir.`);
  }
  const attributes = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Kategori özelliği geçersiz.");
    const input = item as Record<string, unknown>;
    if (typeof input.key !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(input.key)) {
      throw new Error("Özellik anahtarı küçük harf, rakam ve tire içerebilir.");
    }
    return { key: input.key, ...parseAttributeTemplate(input) };
  });
  if (new Set(attributes.map((attribute) => attribute.key)).size !== attributes.length) {
    throw new Error("Özellik anahtarları birbirinden farklı olmalı.");
  }
  if (new Set(attributes.map((attribute) => normalizeAttributeLabel(attribute.label))).size !== attributes.length) {
    throw new Error("Özellik adları birbirinden farklı olmalı.");
  }
  return attributes;
}

export type ProductAttributeValue = string | number | boolean | string[];

export type ProductAttribute = {
  key: string;
  value: ProductAttributeValue;
};
