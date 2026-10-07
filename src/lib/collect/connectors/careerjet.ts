import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { companyKey, htmlToText } from "../normalize";
import type { SearchQuery } from "./adzuna";

// Careerjet search API v4 (free publisher key, basic auth). Like Jooble it returns an excerpt; the
// full posting is completed before judging. It asks for the end user's IP and browser: the collection
// runs on a server, so a fixed, declared value is sent (CAREERJET_USER_IP, the site's own address).
const ENDPOINT = "https://search.api.careerjet.net/v4/query";
const PAGE_SIZE = 50;
const MAX_PAGES = 2;
const LOCALES: Record<string, string> = { FR: "fr_FR", BE: "fr_BE", CH: "fr_CH", LU: "fr_LU", CA: "fr_CA", GB: "en_GB", DE: "de_DE", ES: "es_ES", IT: "it_IT", NL: "nl_NL", PT: "pt_PT", IE: "en_IE", US: "en_US" };

export function isCareerjetConfigured() {
  return Boolean(process.env.CAREERJET_API_KEY);
}

type CareerjetJob = { title?: string; company?: string; locations?: string; location?: string; description?: string; url?: string; date?: string; salary?: string };

function normalize(j: CareerjetJob): NormalizedOffer | null {
  if (!j.url || !j.title) return null;
  const title = htmlToText(j.title);
  const description = htmlToText(j.description ?? "");
  const raw = j.locations ?? j.location ?? null;
  const loc = parseLocation(raw, title);
  if (loc.places.length === 0) loc.places = [{ country: "FR" }];
  return {
    sourceKey: "careerjet",
    sourceUrl: j.url,
    company: { name: j.company?.trim() || "Entreprise non communiquée" },
    title,
    locationRaw: raw,
    ...loc,
    contract: detectContract(title, null, description),
    experienceMinYears: detectExperienceYears(description),
    description,
    applyUrl: j.url,
    publishedAt: j.date && !Number.isNaN(Date.parse(j.date)) ? new Date(j.date).toISOString() : null,
  };
}

export async function fetchCareerjet(queries: SearchQuery[]): Promise<NormalizedOffer[]> {
  const out = new Map<string, NormalizedOffer>();
  const auth = `Basic ${Buffer.from(`${process.env.CAREERJET_API_KEY}:`).toString("base64")}`;
  for (const q of queries) {
    // A favourite without a readable career page is searched by name: only its own offers are kept.
    const wanted = q.company ? companyKey(q.company) : null;
    for (let page = 0; page < (q.company ? 1 : MAX_PAGES); page++) {
      const url = new URL(ENDPOINT);
      url.searchParams.set("locale_code", LOCALES[q.country ?? "FR"] ?? "fr_FR");
      url.searchParams.set("keywords", q.company ?? q.what);
      if (q.where) url.searchParams.set("location", q.where);
      url.searchParams.set("page_size", String(PAGE_SIZE));
      url.searchParams.set("offset", String(page * PAGE_SIZE));
      url.searchParams.set("sort", "date");
      url.searchParams.set("user_ip", process.env.CAREERJET_USER_IP ?? "76.76.21.21");
      url.searchParams.set("user_agent", "Mozilla/5.0 (compatible; Scout job aggregator)");
      const res = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      const data = (await res.json()) as { jobs?: CareerjetJob[] };
      for (const j of data.jobs ?? []) {
        if (wanted && companyKey(j.company ?? "") !== wanted) continue;
        const offer = normalize(j);
        if (offer) out.set(offer.sourceUrl, offer);
      }
      if ((data.jobs?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return [...out.values()];
}
