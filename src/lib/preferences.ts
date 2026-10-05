"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createLocalStorageStore, useHydrated } from "./storage";

export type Theme = "system" | "light" | "dark";

const THEME_KEY = "job-scout:theme";
const SIDEBAR_KEY = "job-scout:sidebar-collapsed";

const themeStore = createLocalStorageStore<Theme>(THEME_KEY, "system");

export function useTheme() {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot);
  const hydrated = useHydrated();
  const setTheme = useCallback((next: Theme) => themeStore.set(next), []);
  return { theme, setTheme, hydrated };
}

const sidebarStore = createLocalStorageStore<boolean>(SIDEBAR_KEY, false);

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.getSnapshot, sidebarStore.getServerSnapshot);
  const hydrated = useHydrated();
  const setCollapsed = useCallback((next: boolean) => sidebarStore.set(next), []);
  return { collapsed, setCollapsed, hydrated };
}
