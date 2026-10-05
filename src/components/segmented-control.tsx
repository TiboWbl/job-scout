"use client";

import clsx from "clsx";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-hover p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-surface text-foreground shadow-[var(--shadow-card)]"
              : "text-foreground-secondary hover:text-foreground",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
