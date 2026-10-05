"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/preferences";

export function ThemeApplier() {
  const { theme, hydrated } = useTheme();

  useEffect(() => {
    if (!hydrated) return;
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme, hydrated]);

  return null;
}
