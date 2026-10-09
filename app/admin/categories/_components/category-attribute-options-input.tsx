"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ATTRIBUTE_OPTION_LIMIT, normalizeAttributeLabel } from "@/lib/catalog/attributes";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function CategoryAttributeOptionsInput({
  options = [],
  onChange,
  disabled,
}: {
  options: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const addValues = (raw: string) => {
    if (disabled) return;
    const candidates = raw
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;

    const existingLower = new Set(options.map(normalizeAttributeLabel));
    const added: string[] = [];
    for (const cand of candidates) {
      const lower = normalizeAttributeLabel(cand);
      if (!existingLower.has(lower)) {
        existingLower.add(lower);
        added.push(cand);
      }
    }
    if (options.length + added.length > ATTRIBUTE_OPTION_LIMIT) {
      setError(`En fazla ${ATTRIBUTE_OPTION_LIMIT} seçenek eklenebilir.`);
      return;
    }
    setError(null);
    if (added.length > 0) {
      onChange([...options, ...added]);
    }
    setDraft("");
  };

  const removeAt = (index: number) => {
    setError(null);
    onChange(options.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      addValues(draft);
    } else if (event.key === "Backspace" && !draft && options.length > 0) {
      event.preventDefault();
      removeAt(options.length - 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (pasted.includes(",") || pasted.includes("\n") || pasted.includes(";")) {
      event.preventDefault();
      addValues(pasted);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-foreground">
          Seçenekler <span className="text-destructive">*</span>
        </label>
        {options.length > 0 && (
          <span className="text-muted-foreground text-[11px]" aria-live="polite">
            {options.length} / {ATTRIBUTE_OPTION_LIMIT} seçenek
          </span>
        )}
      </div>

      <div
        role="group"
        aria-label="Özellik seçenekleri"
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background p-1.5 transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      >
        <div role="list" aria-label="Eklenen seçenekler" className="flex flex-wrap items-center gap-1.5">
          {options.map((option, index) => (
            <span
              key={`${option}-${index}`}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              <span>{option}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(index);
                }}
                className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${option} seçeneğini sil`}
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-1 items-center min-w-[100px]">
          <input
            id={id}
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={draft}
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Yeni seçenek ekle"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => {
              if (draft.trim()) addValues(draft);
            }}
            placeholder={options.length === 0 ? "Örn. Pamuk, Keten..." : "Seçenek ekle..."}
            className="h-7 w-full bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {draft.trim() && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addValues(draft)}
            className="h-6 px-2 text-xs"
          >
            Ekle
          </Button>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
