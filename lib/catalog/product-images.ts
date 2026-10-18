export function getImagesForVariant<T extends { selectedOptions?: { name: string; value: string }[] }>(
  images: T[],
  selection: Array<{ name: string; value: string }>,
) {
  const scoped = selection.length
    ? images.filter(
        (image) =>
          image.selectedOptions?.length &&
          image.selectedOptions.every((opt) =>
            selection.some((sel) => sel.name === opt.name && sel.value === opt.value),
          ),
      )
    : [];
  const shared = images.filter((image) => !image.selectedOptions?.length);
  const visible = [...scoped, ...shared];
  return visible.length ? visible : images;
}
