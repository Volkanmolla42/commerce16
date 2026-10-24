"use client";

import type { Dispatch, SetStateAction } from "react";
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  selectionKey,
  type VariantDraft,
  type VariantOptionDraft,
} from "./product-editor-helpers";
import { VariantOptionValuesInput } from "./variant-option-values-input";

export function ProductVariantsSection(props: {
  variantOptions: VariantOptionDraft[];
  setVariantOptions: Dispatch<SetStateAction<VariantOptionDraft[]>>;
  addVariantOption: () => void;
  removeVariantOption: (optionId: string) => void;
  generateVariantRows: () => void;
  variantRows: VariantDraft[];
  updateVariant: (index: number, patch: Partial<VariantDraft>) => void;
  removeVariant: (index: number) => void;
  selectionKey: (selectedOptions: { name: string; value: string }[]) => string;
}) {
  const {
    variantOptions,
    setVariantOptions,
    addVariantOption,
    removeVariantOption,
    generateVariantRows,
    variantRows,
    updateVariant,
    removeVariant,
  } = props;

  return (
          <section aria-label="Varyantlar" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Varyantlar</h2>
              </div>
                  <section aria-label="Varyant seçenekleri" className="mb-4 space-y-3 rounded-xl border border-border bg-background/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-foreground">Varyant seçenekleri</h4>
                      <Button type="button" variant="outline" className="min-h-9 rounded-lg border-border bg-background px-3 text-xs text-foreground hover:bg-muted" disabled={variantOptions.length >= 3} onClick={addVariantOption}>
                        <PlusCircleIcon className="mr-2 size-4" /> Seçenek ekle
                      </Button>
                    </div>
                    {variantOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Seçenek eklemeden ürün tek kombinasyon olarak kaydedilir.
                      </div>
                    ) : (
                      variantOptions.map((option, index) => (
                        <div key={option.id} className="grid gap-3 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor={`variant-option-name-${index}`} className="text-xs text-muted-foreground">Seçenek adı</Label>
                            <Input id={`variant-option-name-${index}`} maxLength={40} value={option.name} onChange={(event) => setVariantOptions((current) => current.map((item) => item.id === option.id ? { ...item, name: event.target.value } : item))} placeholder="Örn. Beden" className="h-10 rounded-lg border-border bg-background text-sm text-foreground" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Değerler</Label>
                            <VariantOptionValuesInput
                              values={option.values}
                              onChange={(nextValues) =>
                                setVariantOptions((current) =>
                                  current.map((item) => (item.id === option.id ? { ...item, values: nextValues } : item))
                                )
                              }
                            />
                          </div>
                          <Button type="button" variant="ghost" className="min-h-10 px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${option.name || `Seçenek ${index + 1}`} seçeneğini kaldır`} onClick={() => removeVariantOption(option.id)}>
                            <TrashIcon className="size-4" />
                          </Button>
                        </div>
                      ))
                    )}
                    {variantOptions.length > 0 && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
                      <Button type="button" variant="secondary" className="min-h-9 rounded-lg px-3 text-xs" onClick={generateVariantRows}>
                        <ArrowPathIcon className="mr-1.5 size-3.5" />
                        Kombinasyonları oluştur
                      </Button>
                    </div>}
                  </section>

                  <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
                      <table className="w-full min-w-[880px] border-collapse text-left text-xs">
                        <thead className="bg-background text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-3 py-3 font-medium">Satışta</th>
                            <th scope="col" className="px-3 py-3 font-medium">Kombinasyon</th>
                            <th scope="col" className="px-3 py-3 font-medium">Fiyat (TL) <span className="text-destructive">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Liste fiyatı (TL)</th>
                            <th scope="col" className="px-3 py-3 font-medium">Stok</th>
                            <th scope="col" className="px-3 py-3 font-medium">SKU <span className="text-destructive">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Barkod</th>
                            <th scope="col" className="px-3 py-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {variantRows.map((variant, index) => <tr key={variant.id ?? selectionKey(variant.selectedOptions)} className="transition-colors hover:bg-muted/40">
                            <td className="px-3 py-3"><input aria-label={`Kombinasyon ${index + 1} satışta`} type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-foreground" /></td>
                            <td className="min-w-36 whitespace-nowrap px-3 py-3 font-medium text-foreground">{variant.selectedOptions.map(({ value }) => value).join(" / ") || "Tek ürün"}</td>
                            <td className="w-28 px-2 py-3"><Input aria-label={`Kombinasyon ${index + 1} fiyatı`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-10 rounded-lg border-border bg-background text-xs text-foreground" /></td>
                            <td className="w-28 px-2 py-3"><Input aria-label={`Kombinasyon ${index + 1} liste fiyatı`} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Opsiyonel" value={variant.compareAtPrice} onChange={(event) => updateVariant(index, { compareAtPrice: event.target.value })} className="h-10 rounded-lg border-border bg-background text-xs text-foreground" /></td>
                            <td className="w-24 px-2 py-3"><Input aria-label={`Kombinasyon ${index + 1} stok adedi`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-10 rounded-lg border-border bg-background text-xs text-foreground" /></td>
                            <td className="min-w-36 px-3 py-3"><Input aria-label={`Kombinasyon ${index + 1} SKU`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-10 rounded-lg border-border bg-background font-mono text-xs text-foreground" /></td>
                            <td className="min-w-32 px-3 py-3"><Input aria-label={`Kombinasyon ${index + 1} Barkod`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-10 rounded-lg border-border bg-background font-mono text-xs text-foreground" /></td>
                            <td className="px-2 py-3"><Button type="button" variant="ghost" aria-label={`Kombinasyon ${index + 1} seçeneğini kaldır`} className="min-h-9 px-2 text-muted-foreground hover:bg-muted hover:text-foreground" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button></td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {variantRows.map((variant, index) => <section key={variant.id ?? selectionKey(variant.selectedOptions)} aria-label={`Kombinasyon ${index + 1}`} className="space-y-3 rounded-xl border border-border bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">{variant.selectedOptions.length > 0 ? variant.selectedOptions.map((selected) => <span key={selected.name} className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">{selected.name}: {selected.value}</span>) : <span className="text-xs text-muted-foreground">Tek ürün</span>}</div>
                          <Button type="button" variant="ghost" aria-label={`Kombinasyon ${index + 1} seçeneğini kaldır`} className="min-h-8 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button>
                        </div>
                        <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-foreground" />Satışta</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5"><Label htmlFor={`mobile-variant-price-${index}`} className="text-xs text-muted-foreground">Fiyat (TL) <span className="text-destructive">*</span></Label><Input id={`mobile-variant-price-${index}`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-10 rounded-lg border-border bg-card text-xs text-foreground" /></div>
                          <div className="space-y-1.5"><Label htmlFor={`mobile-variant-stock-${index}`} className="text-xs text-muted-foreground">Stok adedi</Label><Input id={`mobile-variant-stock-${index}`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-10 rounded-lg border-border bg-card text-xs text-foreground" /></div>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor={`mobile-variant-compare-at-${index}`} className="text-xs text-muted-foreground">Liste fiyatı (TL)</Label><Input id={`mobile-variant-compare-at-${index}`} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Opsiyonel" value={variant.compareAtPrice} onChange={(event) => updateVariant(index, { compareAtPrice: event.target.value })} className="h-10 rounded-lg border-border bg-card text-xs text-foreground" /></div>
                        <div className="space-y-1.5"><Label htmlFor={`mobile-variant-sku-${index}`} className="text-xs text-muted-foreground">SKU <span className="text-destructive">*</span></Label><Input id={`mobile-variant-sku-${index}`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-10 rounded-lg border-border bg-card font-mono text-xs text-foreground" /></div>
                        <div className="space-y-1.5"><Label htmlFor={`mobile-variant-barcode-${index}`} className="text-xs text-muted-foreground">Barkod</Label><Input id={`mobile-variant-barcode-${index}`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-10 rounded-lg border-border bg-card font-mono text-xs text-foreground" /></div>
                      </section>)}
                  </div>
            </div>
          </section>

  );
}
