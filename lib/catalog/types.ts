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

export type Page = {
  id: string;
  title: string;
  slug: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
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
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
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
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  price: string;
  availableForSale: boolean;
  categorySlug?: string;
  images: string[];
  options?: ProductOption[];
  variants?: ProductVariant[];
  seo?: SEO;
  updatedAt: string;
};
