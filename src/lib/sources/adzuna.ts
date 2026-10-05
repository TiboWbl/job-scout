import { JobOffer, ContractType } from "@/lib/types";
import {
  colorForCompany,
  deriveCompanyBlurb,
  guessDomain,
  guessWorkMode,
  initialsForCompany,
  stripHtml,
  truncate,
} from "./normalize";

const SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/fr/search";

const DEFAULT_QUERIES = ["product manager", "product owner"];

interface AdzunaOffer {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  contract_time?: string;
  created?: string;
  category?: { label?: string };
}

function mapContractType(offer: AdzunaOffer): ContractType {
  if (offer.contract_type === "contract") return "Freelance";
  if (offer.contract_time === "part_time") return "CDD";
  return "CDI";
}

function normalize(offer: AdzunaOffer): JobOffer | null {
  if (!offer.id || !offer.title) return null;

  const company = offer.company?.display_name?.trim() || "Entreprise non communiquée";
  const description = stripHtml(offer.description ?? "");

  return {
    id: `adzuna-${offer.id}`,
    title: offer.title.replace(/<[^>]+>/g, ""),
    company,
    companyInitials: initialsForCompany(company),
    companyColor: colorForCompany(company),
    companyDomain: guessDomain(company),
    companyDescription: deriveCompanyBlurb(description),
    location: offer.location?.display_name?.trim() || "France",
    workMode: guessWorkMode(description),
    contractType: mapContractType(offer),
    domains: [],
    salaryMin: offer.salary_min ? Math.round(offer.salary_min / 1000) : undefined,
    salaryMax: offer.salary_max ? Math.round(offer.salary_max / 1000) : undefined,
    pitch: truncate(description, 160),
    fullDescription: description,
    tags: offer.category?.label ? [offer.category.label] : [],
    companySize: "Non précisé",
    source: "Adzuna",
    sourceUrl: offer.redirect_url,
    postedAt: offer.created ?? new Date().toISOString(),
  };
}

export async function fetchAdzunaOffers(queries: string[] = DEFAULT_QUERIES): Promise<JobOffer[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = new URL(`${SEARCH_URL}/1`);
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("what", q);
      url.searchParams.set("results_per_page", "50");
      url.searchParams.set("content-type", "application/json");

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) {
        throw new Error(`Adzuna search failed (${res.status}) for "${q}"`);
      }
      const data = (await res.json()) as { results?: AdzunaOffer[] };
      return data.results ?? [];
    }),
  );

  const byId = new Map<string, JobOffer>();
  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("Adzuna:", result.reason);
      continue;
    }
    for (const raw of result.value) {
      const offer = normalize(raw);
      if (offer) byId.set(offer.id, offer);
    }
  }

  return [...byId.values()];
}
