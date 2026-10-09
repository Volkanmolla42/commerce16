import type { Product, ProductImage, ProductVariant } from "./types";

function matchesScope(
  scope: ProductImage["selectedOptions"],
  selection: Array<{ name: string; value: string }>,
) {
  return (scope ?? []).every(({ name, value }) =>
    selection.some((selected) => selected.name === name && selected.value === value),
  );
}

export function getImagesForVariant<T extends { selectedOptions?: { name: string; value: string }[] }>(
  images: T[],
  selection: Array<{ name: string; value: string }>,
) {
  const shared = images.filter((image) => !image.selectedOptions?.length);
  const scoped = selection.length
    ? images.filter((image) => image.selectedOptions?.length && matchesScope(image.selectedOptions, selection))
    : [];
  const visible = [...shared, ...scoped];
  return visible.length || selection.length ? visible : images.slice(0, 1);
}

export function getProductImagesForSelection(
  images: ProductImage[],
  selection: Array<{ name: string; value: string }>,
) {
  return getImagesForVariant(images, selection);
}

export function getProductImages(product: Pick<Product, "images">) {
  const shared = product.images.filter((image) => !image.selectedOptions?.length);
  return shared.length ? shared : product.images.slice(0, 1);
}

export function getVariantImages(product: Pick<Product, "images">, variant?: ProductVariant) {
  return getProductImagesForSelection(product.images, variant?.selectedOptions ?? []);
}
