import {
  attributeMessages,
  defaultRowState,
  type ImportError,
  type PreviewResult,
  type RowFilter,
  type RowState,
  type TableRow,
} from "./import-preview";

export function buildImportRows(
  preview: PreviewResult | null,
  edits: Record<string, RowState>,
): TableRow[] {
  const categoryBySlug = new Map((preview?.categoryOptions ?? []).map((category) => [category.slug, category]));
  const errorsBySlug = new Map<string, ImportError[]>();
  for (const item of preview?.errors ?? []) {
    if (!item.slug) continue;
    errorsBySlug.set(item.slug, [...(errorsBySlug.get(item.slug) ?? []), item]);
  }

  return (preview?.products ?? []).map((product) => {
    const edit = edits[product.slug] ?? defaultRowState(product);
    const category = categoryBySlug.get(edit.categorySlug);
    const fieldErrors = (errorsBySlug.get(product.slug) ?? []).filter(
      (item) => item.scope !== "category" && item.scope !== "attribute",
    );
    const attributeErrors: Record<string, string[]> = {};
    const messages: string[] = [];
    if (!category) {
      messages.push("Kategori seçimi zorunludur.");
    } else {
      for (const definition of category.attributes ?? []) {
        const next = attributeMessages(definition, edit.values[definition.key]);
        attributeErrors[definition.key] = next;
        messages.push(...next);
      }
    }
    return {
      product,
      edit,
      category,
      categoryMessage: category ? null : "Kategori seçiniz.",
      attributeErrors,
      validation: {
        messages,
        fieldErrors,
        ready: messages.length === 0 && fieldErrors.length === 0,
      },
    };
  });
}

export function filterImportRows(rows: TableRow[], filter: RowFilter, searchQuery: string): TableRow[] {
  const query = searchQuery.trim().toLocaleLowerCase("tr-TR");

  return rows.filter((row) => {
    if (filter === "new" && row.product.exists) return false;
    if (filter === "update" && !row.product.exists) return false;
    if (filter === "ready" && !row.validation.ready) return false;
    if (filter === "problem" && row.validation.ready) return false;
    if (query) {
      const matchTitle = row.product.title.toLocaleLowerCase("tr-TR").includes(query);
      const matchSlug = row.product.slug.toLocaleLowerCase("tr-TR").includes(query);
      const matchSku = row.product.variants.some((variant) =>
        variant.sku.toLocaleLowerCase("tr-TR").includes(query),
      );
      if (!matchTitle && !matchSlug && !matchSku) return false;
    }
    return true;
  });
}
