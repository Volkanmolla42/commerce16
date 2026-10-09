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
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
};

export type ProductImage = {
  url: string;
  selectedOptions?: { name: string; value: string }[];
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
  /** Derived minimum price for listing and metadata; sellable prices live on variants. */
  price: string;
  /** Precomputed card prices avoid transferring every SKU to product lists. */
  priceRange?: { min: string; max: string };
  availableForSale: boolean;
  attributes?: ProductAttribute[];
  categorySlug?: string;
  images: ProductImage[];
  options?: ProductOption[];
  variants?: ProductVariant[];
  updatedAt: string;
};
