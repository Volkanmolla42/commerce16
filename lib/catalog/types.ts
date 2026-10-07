import type { CategoryAttributeDefinition, ProductAttribute } from "./attributes";

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};
export type Menu = {
  title: string;
  path: string;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string;
  barcode?: string;
  stockQuantity?: number | null;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  /** When omitted, the variant uses the product's base price. */
  price?: Money;
};

export type SEO = {
  title: string;
  description: string;
};

export type Category = {
  path: string;
  slug: string;
  title: string;
  description: string;
  seo: SEO;
  updatedAt: string;
  imageUrl?: string | null;
  attributes?: CategoryAttributeDefinition[];
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  price: string;
  sku?: string;
  availableForSale: boolean;
  stockQuantity?: number | null;
  brand?: string;
  material?: string;
  attributes?: ProductAttribute[];
  /** Average from verified customer reviews, never a manually assigned catalog value. */
  rating?: number;
  categorySlug?: string;
  images: string[];
  options?: ProductOption[];
  variants?: ProductVariant[];
  updatedAt: string;
};
