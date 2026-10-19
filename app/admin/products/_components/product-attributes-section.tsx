"use client";

import type { Dispatch, SetStateAction } from "react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import {
  AttributeBooleanToggle,
  AttributeMultiSelect,
  AttributeNumberInput,
  AttributeSingleSelect,
} from "./attribute-field-inputs";

export function ProductAttributesSection(props: {
  categoryAttributes: CategoryAttributeDefinition[];
  attributeValues: Record<string, string | string[]>;
  setAttributeValues: Dispatch<SetStateAction<Record<string, string | string[]>>>;
  categorySlug: string;
}) {
  const { categoryAttributes, attributeValues, setAttributeValues, categorySlug } = props;

  return (
    <>
              {categoryAttributes.length > 0 ? (
                <section aria-labelledby="product-category-attributes-heading" className="space-y-4 rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <h3 id="product-category-attributes-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <AdjustmentsHorizontalIcon className="size-4 text-muted-foreground" />
                      Teknik Özellikler
                    </h3>
                    <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                      {categoryAttributes.length} özellik
                    </span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {categoryAttributes.map((attribute: CategoryAttributeDefinition) => {
                      const inputId = `product-attribute-${attribute.key}`;
                      const rawValue = attributeValues[attribute.key];

                      return (
                        <div key={attribute.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={inputId} className="text-xs font-medium text-foreground">
                              {attribute.label}
                              {attribute.unit ? ` (${attribute.unit})` : ""}
                              {attribute.required ? <span className="text-destructive"> *</span> : null}
                            </Label>
                            <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border">
                              {attribute.type === "multiselect"
                                ? "Çoklu Seçim"
                                : attribute.type === "select"
                                  ? "Tekli Seçim"
                                  : attribute.type === "boolean"
                                    ? "Evet / Hayır"
                                    : attribute.type === "number"
                                      ? "Sayı"
                                      : "Metin"}
                            </span>
                          </div>

                          {attribute.type === "multiselect" ? (
                            <AttributeMultiSelect
                              attribute={attribute}
                              value={Array.isArray(rawValue) ? rawValue : []}
                              onChange={(next) =>
                                setAttributeValues((current) => ({
                                  ...current,
                                  [attribute.key]: next,
                                }))
                              }
                            />
                          ) : attribute.type === "select" ? (
                            <AttributeSingleSelect
                              attribute={attribute}
                              value={typeof rawValue === "string" ? rawValue : ""}
                              onChange={(next) =>
                                setAttributeValues((current) => ({
                                  ...current,
                                  [attribute.key]: next,
                                }))
                              }
                            />
                          ) : attribute.type === "boolean" ? (
                            <AttributeBooleanToggle
                              attribute={attribute}
                              value={typeof rawValue === "string" ? rawValue : ""}
                              onChange={(next) =>
                                setAttributeValues((current) => ({
                                  ...current,
                                  [attribute.key]: next,
                                }))
                              }
                            />
                          ) : attribute.type === "number" ? (
                            <AttributeNumberInput
                              attribute={attribute}
                              value={typeof rawValue === "string" ? rawValue : ""}
                              onChange={(next) =>
                                setAttributeValues((current) => ({
                                  ...current,
                                  [attribute.key]: next,
                                }))
                              }
                            />
                          ) : (
                            <Input
                              id={inputId}
                              type="text"
                              required={attribute.required}
                              value={typeof rawValue === "string" ? rawValue : ""}
                              onChange={(event) =>
                                setAttributeValues((current) => ({
                                  ...current,
                                  [attribute.key]: event.target.value,
                                }))
                              }
                              placeholder={attribute.label}
                              className="h-11 rounded-lg border-border bg-card text-sm text-foreground placeholder:text-muted-foreground"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : categorySlug ? (
                <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-xs text-muted-foreground">
                  Bu kategori için özellik tanımlanmamış.
                </div>
              ) : null}
    </>
  );
}
