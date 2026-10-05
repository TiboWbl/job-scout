"use client";

import { useEffect, useState } from "react";
import { JobOffer, Source } from "./types";

interface OffersResponse {
  offers: JobOffer[];
  activeSources: Source[];
  fetchedAt: string;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; offers: JobOffer[]; activeSources: Source[] };

export function useOffers() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/offers", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json() as Promise<OffersResponse>;
      })
      .then((data) => setState({ status: "ready", offers: data.offers, activeSources: data.activeSources }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  return state;
}
