"use client";

import { ChevronDown } from "lucide-react";
import { SelectHTMLAttributes } from "react";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`appearance-none rounded-full border border-border bg-surface py-2.5 pl-3.5 pr-9 text-sm text-foreground-secondary focus:border-accent focus:outline-none ${className ?? ""}`}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-tertiary"
      />
    </div>
  );
}
