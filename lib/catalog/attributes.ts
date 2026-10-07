export type CategoryAttributeType = "text" | "number" | "select" | "multiselect" | "boolean";

export type CategoryAttributeDefinition = {
  key: string;
  label: string;
  type: CategoryAttributeType;
  unit?: string;
  options?: string[];
  required: boolean;
  filterable?: boolean;
};

export type ProductAttributeValue = string | number | boolean | string[];

export type ProductAttribute = {
  key: string;
  value: ProductAttributeValue;
};
