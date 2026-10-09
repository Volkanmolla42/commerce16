"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Input, Label } from "@/components/ui";
import {
  CATEGORY_ATTRIBUTE_LIMIT, normalizeAttributeLabel, parseAttributeTemplate,
  type CategoryAttributeDefinition, type CategoryAttributeTemplate,
} from "@/lib/catalog/attributes";
import { runAdminAction, useAdminResource } from "../../_components/admin-api";
import { CategoryAttributeFields } from "./category-attribute-fields";

export type CategoryAttributePreset = Pick<Doc<"categoryAttributePresets">, "_id" | "label" | "type" | "unit" | "options" | "required">;
type PresetPage = { page: CategoryAttributePreset[]; continueCursor: string; isDone: boolean };
type Draft = { id: CategoryAttributePreset["_id"]; value: CategoryAttributeTemplate };

export function CategoryAttributeLibrary({ onAdd, attributes, disabled, revision, onBusyChange }: {
  onAdd: (preset: CategoryAttributePreset) => void;
  attributes: CategoryAttributeDefinition[];
  disabled: boolean;
  revision: number;
  onBusyChange: (busy: boolean) => void;
}) {
  const searchId = useId();
  const resultsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [nativePopover, setNativePopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<CSSProperties>({});
  const [cursors, setCursors] = useState<string[]>([""]);
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryAttributePreset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    onBusyChange(busy || draft !== null || deleteTarget !== null);
    return () => onBusyChange(false);
  }, [busy, draft, deleteTarget, onBusyChange]);
  useEffect(() => {
    setNativePopover(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype);
  }, []);
  useEffect(() => {
    if (!open || draft || deleteTarget || busy) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open, draft, deleteTarget, busy]);
  useEffect(() => {
    const popover = popoverRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!open || !nativePopover || !popover || !containerRef.current) return;

    const updatePosition = () => {
      const trigger = containerRef.current?.querySelector("input");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 24);
      const centeredLeft = rect.left + rect.width / 2 - width / 2;
      const left = Math.max(12, Math.min(centeredLeft, window.innerWidth - width - 12));
      const below = Math.max(0, window.innerHeight - rect.bottom - 16);
      const above = Math.max(0, rect.top - 16);
      const opensBelow = below >= 280 || below >= above;
      const maxHeight = Math.max(120, Math.min(448, opensBelow ? below : above));
      const position: CSSProperties = {
        left,
        width,
        maxHeight,
        top: opensBelow ? rect.bottom + 8 : "auto",
        bottom: opensBelow ? "auto" : window.innerHeight - rect.top + 8,
      };
      popover.style.left = `${left}px`;
      popover.style.width = `${width}px`;
      popover.style.maxHeight = `${maxHeight}px`;
      popover.style.top = opensBelow ? `${rect.bottom + 8}px` : "auto";
      popover.style.bottom = opensBelow ? "auto" : `${window.innerHeight - rect.top + 8}px`;
      setPopoverPosition(position);
    };

    updatePosition();
    popover.showPopover?.();
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (popover.matches(":popover-open")) popover.hidePopover?.();
    };
  }, [open, nativePopover]);
  const resource = useAdminResource<PresetPage>("category-attribute-presets", {
    q: query, cursor: cursors[cursors.length - 1], revision: `${revision}:${version}`,
  });
  const pending = resource.loading || query !== search;
  const presets = pending ? [] : resource.data?.page ?? [];
  const hasSearch = search.trim().length > 0;
  const locked = disabled || busy;
  const addedLabels = new Set(attributes.map((attribute) => normalizeAttributeLabel(attribute.label)));

  const save = async () => {
    if (!draft || locked) return;
    setError(null);
    setBusy(true);
    try {
      const template = parseAttributeTemplate(draft.value);
      await runAdminAction("category-attribute-preset.update", { ...template, id: draft.id });
      setNotice(`${template.label} güncellendi.`);
      setDraft(null);
      setSearch(template.label);
      setCursors([""]);
      setVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Özellik güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || locked) return;
    setError(null);
    setBusy(true);
    try {
      await runAdminAction("category-attribute-preset.delete", { id: deleteTarget._id });
      setNotice(`${deleteTarget.label} kütüphaneden silindi.`);
      setDeleteTarget(null);
      // A deleted last row must not leave the user stranded on an empty cursor page.
      setCursors([""]);
      setVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Özellik silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !draft && !deleteTarget && !busy) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        if (!draft && !deleteTarget && !busy) setOpen(false);
      }
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "search") event.preventDefault();
    }}>
      <Label htmlFor={searchId} className="sr-only">Kütüphanede ara</Label>
      <Input
        id={searchId}
        type="search"
        value={search}
        maxLength={200}
        disabled={locked || draft !== null || deleteTarget !== null}
        aria-expanded={open}
        aria-controls={open ? resultsId : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSearch(event.target.value);
          setCursors([""]);
          setNotice("");
        }}
        placeholder="Kütüphanede ara"
      />
      {open && (
        <section
          id={resultsId}
          role="dialog"
          aria-label="Özellik kütüphanesi"
          ref={popoverRef}
          popover="manual"
          style={nativePopover ? popoverPosition : undefined}
          className={`${nativePopover ? "fixed inset-auto m-0" : "absolute bottom-full left-1/2 mb-2 w-[min(35rem,calc(100vw-2rem))] max-h-[60dvh] -translate-x-1/2"} z-[60] overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-xl`}
        >
          <h4 className="text-sm font-medium">Özellik kütüphanesi</h4>
          <p className="mt-1 text-xs text-muted-foreground">Kategoriye eklenenler bağımsız kopyadır.</p>
          {draft && <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3" onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement && event.target.type !== "checkbox") {
              event.preventDefault();
            }
          }}>
            <h5 className="text-sm font-medium">Kaydı düzenle</h5>
            <CategoryAttributeFields value={draft.value} onChange={(patch) => setDraft((current) => current ? { ...current, value: { ...current.value, ...patch } } : null)} disabled={locked} required={false} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => { setDraft(null); setError(null); }}>Vazgeç</Button>
              <Button type="button" size="sm" disabled={locked} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
            </div>
          </div>}
          {deleteTarget && <div className="mt-3 space-y-2 rounded-lg border border-destructive/30 bg-background p-3">
            <p className="text-sm"><strong>{deleteTarget.label}</strong> kütüphaneden silinsin mi?</p>
            <p className="text-xs text-muted-foreground">Kategorilerdeki kopyaları korunur.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => { setDeleteTarget(null); setError(null); }}>Vazgeç</Button>
              <Button type="button" variant="destructive" size="sm" disabled={locked} onClick={() => void remove()}>{busy ? "Siliniyor…" : "Kütüphaneden sil"}</Button>
            </div>
          </div>}
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mt-2 text-xs text-muted-foreground">{notice}</p>}
          {hasSearch && !draft && !deleteTarget && <div className="mt-3 space-y-1.5">
            {pending && <p role="status" className="py-3 text-xs text-muted-foreground">Özellikler yükleniyor…</p>}
            {resource.error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <span>{resource.error}</span><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void resource.refresh()}>Tekrar dene</Button>
            </div>}
            {!pending && !resource.error && presets.length === 0 && <p className="py-3 text-xs text-muted-foreground">Eşleşme yok.</p>}
            {presets.length > 0 && !resource.error && <ul className="-mx-2 divide-y divide-border">
              {presets.map((preset) => {
                const added = addedLabels.has(normalizeAttributeLabel(preset.label));
                const actionsDisabled = locked || draft !== null || deleteTarget !== null;
                return <li key={preset._id} className="group flex flex-col gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{preset.label}</p>
                    {preset.options && <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{preset.options.join(", ")}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button type="button" variant="secondary" size="sm" disabled={actionsDisabled || added || attributes.length >= CATEGORY_ATTRIBUTE_LIMIT} aria-label={`${preset.label}: kategoriye ekle`} onClick={() => onAdd(preset)}>{added ? "Eklendi" : "Ekle"}</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={actionsDisabled} aria-label={`${preset.label}: düzenle`} onClick={() => { setDraft({ id: preset._id, value: parseAttributeTemplate(preset) }); setError(null); setNotice(""); }}>Düzenle</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={actionsDisabled} aria-label={`${preset.label}: kütüphaneden sil`} onClick={() => { setDeleteTarget(preset); setError(null); setNotice(""); }}>Sil</Button>
                  </div>
                </li>;
              })}
            </ul>}
          </div>}
          {attributes.length >= CATEGORY_ATTRIBUTE_LIMIT && <p className="mt-2 text-xs text-muted-foreground">Kategori {CATEGORY_ATTRIBUTE_LIMIT} özellik sınırına ulaştı.</p>}
          {hasSearch && !draft && !deleteTarget && resource.data && !resource.error && (cursors.length > 1 || !resource.data.isDone) && <nav aria-label="Özellik kütüphanesi sayfaları" className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" disabled={locked || pending || draft !== null || deleteTarget !== null || cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Önceki</Button>
            <span className="text-xs text-muted-foreground">Sayfa {cursors.length}</span>
            <Button type="button" variant="outline" size="sm" disabled={locked || pending || draft !== null || deleteTarget !== null || resource.data.isDone} onClick={() => setCursors((current) => [...current, resource.data!.continueCursor])}>Sonraki</Button>
          </nav>}
        </section>
      )}
    </div>
  );
}
