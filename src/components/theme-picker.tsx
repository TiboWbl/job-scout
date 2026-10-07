"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const OPTIONS: { key: Theme; label: string }[] = [
  { key: "auto", label: "Automatique" },
  { key: "light", label: "Clair" },
  { key: "dark", label: "Sombre" },
];

// Kept on this device (a display preference, not account data); applied before paint by the root layout.
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scout-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the device preference once
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // storage unavailable: the system theme applies
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try {
      if (next === "auto") localStorage.removeItem("scout-theme");
      else localStorage.setItem("scout-theme", next);
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <div role="radiogroup" aria-label="Thème" className="inline-flex rounded-xl border border-line bg-surface p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={theme === o.key}
          onClick={() => choose(o.key)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium ${theme === o.key ? "bg-button text-button-ink" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
