import { JobOffer, ContractType, OfferStatus } from "@/lib/types";
import {
  colorForCompany,
  deriveCompanyBlurb,
  guessDomain,
  guessWorkMode,
  initialsForCompany,
  stripHtml,
  truncate,
} from "./normalize";

const TOKEN_URL = "https://francetravail.io/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const OFFER_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

// Default search terms when nothing more specific is supplied — broad enough to surface
// product-management roles across company sites and boards France Travail aggregates.
const DEFAULT_QUERIES = ["product manager", "product owner", "chef de produit digital"];

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("France Travail: échec de l'authentification", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

const CONTRACT_MAP: Record<string, ContractType> = {
  CDI: "CDI",
  CDD: "CDD",
  MIS: "CDD",
  SAI: "CDD",
  LIB: "Freelance",
};

interface FranceTravailOffer {
  id: string;
  intitule: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string };
  typeContrat?: string;
  alternance?: boolean;
  salaire?: { libelle?: string };
  romeLibelle?: string;
  qualificationLibelle?: string;
  origineOffre?: { urlOrigine?: string };
}

function parseSalary(libelle: string | undefined): { min?: number; max?: number } {
  if (!libelle) return {};
  const numbers = libelle
    .replace(",", ".")
    .match(/\d+(\.\d+)?/g)
    ?.map(Number)
    .filter((n) => n > 1000); // ignore stray small numbers (e.g. "12 mois")
  if (!numbers || numbers.length === 0) return {};

  const isMonthly = /mensuel/i.test(libelle);
  const toAnnualK = (n: number) => Math.round((isMonthly ? n * 12 : n) / 1000);

  if (numbers.length === 1) return { min: toAnnualK(numbers[0]), max: toAnnualK(numbers[0]) };
  return { min: toAnnualK(Math.min(...numbers)), max: toAnnualK(Math.max(...numbers)) };
}

function normalize(offer: FranceTravailOffer): JobOffer | null {
  if (!offer.id || !offer.intitule) return null;

  const company = offer.entreprise?.nom?.trim() || "Entreprise non communiquée";
  const description = stripHtml(offer.description ?? "");
  const { min, max } = parseSalary(offer.salaire?.libelle);

  return {
    id: `france-travail-${offer.id}`,
    title: offer.intitule,
    company,
    companyInitials: initialsForCompany(company),
    companyColor: colorForCompany(company),
    companyDomain: guessDomain(company),
    companyDescription: deriveCompanyBlurb(description),
    location: offer.lieuTravail?.libelle?.trim() || "France",
    workMode: guessWorkMode(description),
    contractType: offer.alternance ? "Alternance" : (offer.typeContrat && CONTRACT_MAP[offer.typeContrat]) || "CDI",
    domains: [],
    salaryMin: min,
    salaryMax: max,
    pitch: truncate(description, 160),
    fullDescription: description,
    tags: [offer.romeLibelle, offer.qualificationLibelle].filter((t): t is string => Boolean(t)),
    companySize: "Non précisé",
    source: "France Travail",
    sourceUrl: offer.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${offer.id}`,
    postedAt: offer.dateCreation ?? new Date().toISOString(),
  };
}

export async function fetchFranceTravailOffers(queries: string[] = DEFAULT_QUERIES): Promise<JobOffer[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = new URL(SEARCH_URL);
      url.searchParams.set("motsCles", q);
      url.searchParams.set("range", "0-49");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
      });
      if (!res.ok && res.status !== 206) {
        throw new Error(`France Travail search failed (${res.status}) for "${q}"`);
      }
      const data = (await res.json()) as { resultats?: FranceTravailOffer[] };
      return data.resultats ?? [];
    }),
  );

  const byId = new Map<string, JobOffer>();
  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("France Travail:", result.reason);
      continue;
    }
    for (const raw of result.value) {
      const offer = normalize(raw);
      if (offer) byId.set(offer.id, offer);
    }
  }

  return [...byId.values()];
}

// France Travail exposes a single-offer lookup (unlike Adzuna) — 404 means the posting was
// pulled, which is the signal the "Offre retirée" badge on saved offers relies on.
export async function checkFranceTravailOfferStatus(rawId: string): Promise<OfferStatus> {
  const token = await getAccessToken();
  if (!token) return "unknown";

  try {
    const res = await fetch(`${OFFER_URL}/${rawId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 204) return "expired";
    if (res.ok) return "active";
    return "unknown";
  } catch {
    return "unknown";
  }
}
