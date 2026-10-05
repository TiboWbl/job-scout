"use client";

import { useState } from "react";
import { RemovableChip } from "./chip";

export function TagInput({
  values,
  onChange,
  placeholder,
  suggestions = [],
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const trimmed = value.trim();
    if (trimmed === "" || values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  const remainingSuggestions = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        {values.map((value) => (
          <RemovableChip key={value} label={value} onRemove={() => onChange(values.filter((v) => v !== value))} />
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[140px] flex-1 bg-transparent px-1.5 py-1 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs text-foreground-tertiary hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
