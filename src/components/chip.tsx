"use client";

import clsx from "clsx";
import { X } from "lucide-react";

export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-foreground-secondary hover:border-border-strong hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1.5 pl-3.5 pr-2 text-sm font-medium text-accent">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent/20"
        aria-label={`Retirer ${label}`}
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function StaticTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium text-foreground-secondary">
      {label}
    </span>
  );
}
