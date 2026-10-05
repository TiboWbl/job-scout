"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ApplicationEntry, DEFAULT_CRITERIA, JobOffer, OfferStatus, SearchCriteria } from "./types";

const CRITERIA_KEY = "job-scout:criteria";
const SAVED_KEY = "job-scout:saved-offers";
const APPLICATIONS_KEY = "job-scout:applications";
const CV_TEXT_KEY = "job-scout:cv-text";

function mergeWithFallback<T>(fallback: T, parsed: unknown): T {
  if (Array.isArray(fallback)) {
    return (Array.isArray(parsed) ? parsed : fallback) as T;
  }
  if (typeof fallback === "object" && fallback !== null && typeof parsed === "object" && parsed !== null) {
    return { ...fallback, ...parsed } as T;
  }
  return parsed === undefined ? fallback : (parsed as T);
}

export function createLocalStorageStore<T>(key: string, fallback: T) {
  let listeners: Array<() => void> = [];
  let cachedRaw: string | null = null;
  let cachedValue: T = fallback;

  function getSnapshot(): T {
    const raw = window.localStorage.getItem(key);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
      cachedValue = raw ? mergeWithFallback(fallback, JSON.parse(raw)) : fallback;
    } catch {
      cachedValue = fallback;
    }
    return cachedValue;
  }

  function getServerSnapshot(): T {
    return fallback;
  }

  function subscribe(listener: () => void) {
    listeners.push(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
      window.removeEventListener("storage", listener);
    };
  }

  function set(value: T) {
    cachedValue = value;
    cachedRaw = JSON.stringify(value);
    try {
      window.localStorage.setItem(key, cachedRaw);
    } catch {
      // storage unavailable — value still held in memory for this session
    }
    listeners.forEach((l) => l());
  }

  return { getSnapshot, getServerSnapshot, subscribe, set };
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const criteriaStore = createLocalStorageStore<SearchCriteria>(CRITERIA_KEY, DEFAULT_CRITERIA);

export function useSearchCriteria() {
  const criteria = useSyncExternalStore(criteriaStore.subscribe, criteriaStore.getSnapshot, criteriaStore.getServerSnapshot);
  const hydrated = useHydrated();
  const setCriteria = useCallback((next: SearchCriteria) => criteriaStore.set(next), []);
  return { criteria, setCriteria, hydrated };
}

// Saved offers store the full JobOffer, not just an id — the upstream APIs don't keep a
// stable catalog we can re-look-up later (postings expire, result pages shift), so what the
// user saved yesterday needs to stay intact even if it no longer comes back from a fresh fetch.
const savedStore = createLocalStorageStore<JobOffer[]>(SAVED_KEY, []);

export function useSavedOffers() {
  const savedOffers = useSyncExternalStore(savedStore.subscribe, savedStore.getSnapshot, savedStore.getServerSnapshot);
  const hydrated = useHydrated();

  const setSavedOffers = useCallback((offers: JobOffer[]) => savedStore.set(offers), []);

  const toggleSaved = useCallback((offer: JobOffer) => {
    const current = savedStore.getSnapshot();
    savedStore.set(
      current.some((o) => o.id === offer.id) ? current.filter((o) => o.id !== offer.id) : [...current, offer],
    );
  }, []);

  const isSaved = useCallback((id: string) => savedOffers.some((o) => o.id === id), [savedOffers]);

  const applyStatuses = useCallback((statuses: Record<string, OfferStatus>) => {
    const current = savedStore.getSnapshot();
    const now = new Date().toISOString();
    savedStore.set(
      current.map((o) => (o.id in statuses ? { ...o, status: statuses[o.id], statusCheckedAt: now } : o)),
    );
  }, []);

  return { savedOffers, toggleSaved, isSaved, hydrated, setSavedOffers, applyStatuses };
}

const applicationsStore = createLocalStorageStore<ApplicationEntry[]>(APPLICATIONS_KEY, []);

export function useApplications() {
  const applications = useSyncExternalStore(
    applicationsStore.subscribe,
    applicationsStore.getSnapshot,
    applicationsStore.getServerSnapshot,
  );
  const hydrated = useHydrated();

  const addApplication = useCallback((entry: Omit<ApplicationEntry, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const current = applicationsStore.getSnapshot();
    const newEntry: ApplicationEntry = {
      ...entry,
      id: `app-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    applicationsStore.set([newEntry, ...current]);
    return newEntry;
  }, []);

  const updateApplication = useCallback((id: string, patch: Partial<Pick<ApplicationEntry, "stage" | "notes">>) => {
    const current = applicationsStore.getSnapshot();
    applicationsStore.set(
      current.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
    );
  }, []);

  const removeApplication = useCallback((id: string) => {
    applicationsStore.set(applicationsStore.getSnapshot().filter((a) => a.id !== id));
  }, []);

  const applicationForOffer = useCallback(
    (offerId: string) => applications.find((a) => a.offerId === offerId),
    [applications],
  );

  return { applications, addApplication, updateApplication, removeApplication, applicationForOffer, hydrated };
}

// Kept purely in the browser, like everything else here — the CV text never touches a server.
const cvTextStore = createLocalStorageStore<string>(CV_TEXT_KEY, "");

export function useCvText() {
  const text = useSyncExternalStore(cvTextStore.subscribe, cvTextStore.getSnapshot, cvTextStore.getServerSnapshot);
  const hydrated = useHydrated();
  const setText = useCallback((next: string) => cvTextStore.set(next), []);
  return { text, setText, hydrated };
}
