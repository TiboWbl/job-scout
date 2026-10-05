import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { htmlToText } from "../normalize";

// Adzuna public API (France). Optional: skipped without credentials.
const SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/fr/search";
const MAX_PAGES = 3;

export function isAdzunaConfigured() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

type AdzunaOffer = {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url: string;
  contract_type?: string;
  contract_time?: string;
  created?: string;
};

function normalize(o: AdzunaOffer): NormalizedOffer {
  // Adzuna only exposes a description excerpt; the detail panel links to the full posting.
  const description = htmlToText(o.description ?? "");
  const loc = parseLocation(o.location?.display_name, o.title);
  if (loc.places.length === 0) loc.places = [{ country: "FR" }];
  const explicit = o.contract_type === "contract" ? "freelance" : o.contract_type === "permanent" ? "permanent" : null;
  return {
    sourceKey: "adzuna",
    sourceUrl: o.redirect_url,
    company: { name: o.company?.display_name?.trim() || "Entreprise non communiquée" },
    title: htmlToText(o.title),
    locationRaw: o.location?.display_name ?? null,
    ...loc,
    contract: detectContract(o.title, explicit, description),
    experienceMinYears: detectExperienceYears(description),
    description,
    applyUrl: o.redirect_url,
    publishedAt: o.created ?? null,
  };
}

export async function fetchAdzuna(queries: string[]): Promise<NormalizedOffer[]> {
  const out = new Map<string, NormalizedOffer>();
  for (const q of queries) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(`${SEARCH_URL}/${page}`);
      url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!);
      url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!);
      url.searchParams.set("what", q);
      url.searchParams.set("results_per_page", "50");
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      const data = (await res.json()) as { results?: AdzunaOffer[] };
      for (const o of data.results ?? []) out.set(o.id, normalize(o));
      if ((data.results?.length ?? 0) < 50) break;
    }
  }
  return [...out.values()];
}
