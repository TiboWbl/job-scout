import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { Contract } from "@/lib/domain/criteria";
import type { NormalizedOffer } from "@/lib/domain/offer";

// Official France Travail API (Offres d'emploi v2). Optional: skipped without credentials.
// The token is issued by entreprise.francetravail.fr; francetravail.io only serves the portal.
const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const PAGE = 150; // API maximum per request
const MAX_PER_QUERY = 450;

export function isFranceTravailConfigured() {
  return Boolean(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET);
}

async function token(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID!,
    client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET!,
    scope: "api_offresdemploiv2 o2dsoffre",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`auth HTTP ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const CONTRACTS: Record<string, Contract> = { CDI: "cdi", CDD: "cdd", MIS: "cdd", SAI: "cdd", LIB: "freelance" };

type FtOffer = {
  id: string;
  intitule: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string; url?: string };
  typeContrat?: string;
  alternance?: boolean;
  experienceLibelle?: string;
  experienceExige?: string;
  origineOffre?: { urlOrigine?: string };
};

function normalize(o: FtOffer): NormalizedOffer {
  const description = o.description ?? "";
  const loc = parseLocation(o.lieuTravail?.libelle, `${o.intitule}\n${description.slice(0, 600)}`);
  if (loc.places.length === 0) loc.places = [{ country: "FR" }];
  const expFromField = o.experienceLibelle ? detectExperienceYears(o.experienceLibelle.replace(/an\(s\)/i, "ans d'expérience")) : null;
  const url = o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`;
  return {
    sourceKey: "france-travail",
    sourceUrl: url,
    company: { name: o.entreprise?.nom?.trim() || "Entreprise non communiquée" },
    title: o.intitule.trim(),
    locationRaw: o.lieuTravail?.libelle ?? null,
    ...loc,
    contract: o.alternance ? "alternance" : (o.typeContrat && CONTRACTS[o.typeContrat]) || detectContract(o.intitule, null, description),
    experienceMinYears: o.experienceExige === "D" ? 0 : (expFromField ?? detectExperienceYears(description)),
    description,
    applyUrl: url,
    publishedAt: o.dateCreation ?? null,
  };
}

export async function fetchFranceTravail(queries: string[]): Promise<NormalizedOffer[]> {
  const bearer = await token();
  const out = new Map<string, NormalizedOffer>();
  for (const q of queries) {
    for (let start = 0; start < MAX_PER_QUERY; start += PAGE) {
      const url = new URL(SEARCH_URL);
      url.searchParams.set("motsCles", q);
      url.searchParams.set("range", `${start}-${start + PAGE - 1}`);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(20_000) });
      if (res.status === 204) break;
      if (!res.ok && res.status !== 206) throw new Error(`search HTTP ${res.status}`);
      const data = (await res.json()) as { resultats?: FtOffer[] };
      for (const o of data.resultats ?? []) out.set(o.id, normalize(o));
      if (res.status === 200 || (data.resultats?.length ?? 0) < PAGE) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return [...out.values()];
}
