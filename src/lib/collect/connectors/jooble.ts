import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { htmlToText } from "../normalize";
import type { SearchQuery } from "./adzuna";

// Jooble public API (free key on request). It returns an excerpt of each posting: the offer is
// judged on it, and the link leads to the full posting.
const MAX_PAGES = 3;

export function isJoobleConfigured() {
  return Boolean(process.env.JOOBLE_API_KEY);
}

type JoobleJob = { id: string | number; title: string; location?: string; snippet?: string; type?: string; link: string; company?: string; updated?: string };

function normalize(j: JoobleJob): NormalizedOffer {
  const title = htmlToText(j.title);
  const description = htmlToText(j.snippet ?? "");
  const loc = parseLocation(j.location, title);
  if (loc.places.length === 0) loc.places = [{ country: "FR" }];
  return {
    sourceKey: "jooble",
    sourceUrl: j.link,
    company: { name: j.company?.trim() || "Entreprise non communiquée" },
    title,
    locationRaw: j.location ?? null,
    ...loc,
    contract: detectContract(title, j.type ?? null, description),
    experienceMinYears: detectExperienceYears(description),
    description,
    applyUrl: j.link,
    publishedAt: j.updated ?? null,
  };
}

// Jooble serves every country from one API: "Paris" alone returns Paris, Texas. The country is spelled out.
const COUNTRY_NAMES: Record<string, string> = { FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg", CA: "Canada", GB: "United Kingdom", DE: "Deutschland", ES: "España", PT: "Portugal", NL: "Nederland", IE: "Ireland", IT: "Italia", US: "United States" };
const located = (q: SearchQuery) => {
  const country = q.country ? (COUNTRY_NAMES[q.country] ?? q.country) : "";
  return [q.where && q.where !== country ? q.where : null, country].filter(Boolean).join(", ") || "France";
};

export async function fetchJooble(queries: SearchQuery[]): Promise<NormalizedOffer[]> {
  const out = new Map<string, NormalizedOffer>();
  // Jooble matches company names loosely: favourite-company searches go to Adzuna only.
  for (const q of queries.filter((x) => !x.company)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: q.what, location: located(q), page: String(page) }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      const data = (await res.json()) as { jobs?: JoobleJob[] };
      for (const j of data.jobs ?? []) out.set(String(j.id), normalize(j));
      if ((data.jobs?.length ?? 0) < 20) break;
    }
  }
  return [...out.values()];
}
