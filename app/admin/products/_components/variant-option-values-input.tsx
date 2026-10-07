"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function VariantOptionValuesInput({
  values = [],
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addValues = (raw: string) => {
    const candidates = raw
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;

    const existingLower = new Set(values.map((v) => v.toLocaleLowerCase("tr-TR")));
    const added: string[] = [];
    for (const cand of candidates) {
      const lower = cand.toLocaleLowerCase("tr-TR");
      if (!existingLower.has(lower)) {
        existingLower.add(lower);
        added.push(cand);
      }
    }
    if (added.length > 0) {
      onChange([...values, ...added]);
    }
    setDraft("");
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addValues(draft);
    } else if (event.key === "Backspace" && !draft && values.length > 0) {
      event.preventDefault();
      removeAt(values.length - 1);
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
    <div
      role="group"
      aria-label="Varyant değerleri"
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 transition focus-within:border-neutral-500 focus-within:ring-2 focus-within:ring-neutral-400/30"
    >
      <div role="list" aria-label="Eklenen değerler" className="flex flex-wrap items-center gap-1.5">
        {values.map((val, index) => (
          <span
            key={`${val}-${index}`}
            role="listitem"
            className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-100"
          >
            <span>{val}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                removeAt(index);
              }}
              className="inline-flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
              aria-label={`${val} değerini kaldır`}
            >
              <XMarkIcon className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-1 items-center min-w-[90px]">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={draft}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Yeni varyant değeri ekle"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (draft.trim()) addValues(draft);
          }}
          placeholder={values.length === 0 ? "Örn. 38, 39, 40..." : "Değer ekle..."}
          className="h-7 w-full bg-transparent px-1 text-xs text-neutral-100 placeholder:text-neutral-500 outline-none"
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
  );
}
