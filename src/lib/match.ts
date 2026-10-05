import { PRIORITY_OPTIONS } from "./constants";
import { JobOffer, PriorityKey, SearchCriteria } from "./types";

interface Category {
  key: PriorityKey;
  label: string;
  match: (offer: JobOffer, criteria: SearchCriteria) => boolean;
}

function textIncludes(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  return h.includes(n) || n.includes(h);
}

function missionHaystack(offer: JobOffer): string {
  return [offer.fullDescription, ...offer.tags].join(" ").toLowerCase();
}

function titleMatches(offer: JobOffer, criteria: SearchCriteria): boolean {
  return criteria.jobTitles.some((t) => textIncludes(offer.title, t));
}

function missionKeywordMatches(offer: JobOffer, criteria: SearchCriteria): boolean {
  const hay = missionHaystack(offer);
  return criteria.missionKeywords.some((kw) => kw.trim() !== "" && hay.includes(kw.trim().toLowerCase()));
}

function domainMatches(offer: JobOffer, criteria: SearchCriteria): boolean {
  if (criteria.domains.length === 0) return true;
  return offer.domains.some((d) => criteria.domains.includes(d));
}

// A job title that differs across postings shouldn't hide an otherwise great fit —
// matching on the poste OR on the missions the user actually wants is enough to clear this bar.
function coreMatch(offer: JobOffer, criteria: SearchCriteria): { ok: boolean; labels: string[] } {
  const hasTitles = criteria.jobTitles.length > 0;
  const hasMissionKw = criteria.missionKeywords.length > 0;
  if (!hasTitles && !hasMissionKw) return { ok: true, labels: [] };

  const titleOk = hasTitles && titleMatches(offer, criteria);
  const missionOk = hasMissionKw && missionKeywordMatches(offer, criteria);
  const labels: string[] = [];
  if (titleOk) labels.push("Intitulé");
  if (missionOk) labels.push("Missions recherchées");
  return { ok: titleOk || missionOk, labels };
}

const CATEGORIES: Category[] = [
  {
    key: "domaine",
    label: "Domaine",
    match: domainMatches,
  },
  {
    key: "localisation",
    label: "Localisation",
    match: (offer, criteria) => {
      if (criteria.remoteOnly) return offer.workMode === "Remote";
      const locationOk =
        criteria.locations.length === 0 ||
        offer.workMode === "Remote" ||
        criteria.locations.some((l) => textIncludes(offer.location, l));
      const modeOk = criteria.workModes.length === 0 || criteria.workModes.includes(offer.workMode);
      return locationOk && modeOk;
    },
  },
  {
    key: "contrat",
    label: "Type de contrat",
    match: (offer, criteria) => criteria.contractTypes.length === 0 || criteria.contractTypes.includes(offer.contractType),
  },
  {
    key: "salaire",
    label: "Salaire",
    match: (offer, criteria) => {
      if (offer.contractType === "Freelance") return true;
      const top = offer.salaryMax ?? offer.salaryMin;
      if (top === undefined) return true;
      return top >= criteria.salaryMin;
    },
  },
  {
    key: "taille",
    label: "Taille d'entreprise",
    match: (offer, criteria) => criteria.companySizes.length === 0 || criteria.companySizes.includes(offer.companySize),
  },
  {
    key: "mission",
    label: "Mission & impact",
    match: (offer, criteria) => coreMatch(offer, criteria).ok && domainMatches(offer, criteria),
  },
];

export interface MatchResult {
  score: number;
  matchedLabels: string[];
  excluded: boolean;
}

export function isExcluded(offer: JobOffer, criteria: SearchCriteria): boolean {
  if (criteria.sources.length > 0 && !criteria.sources.includes(offer.source)) return true;
  if (criteria.excludeKeywords.length === 0) return false;
  const haystack = [offer.title, offer.fullDescription, offer.company, ...offer.tags].join(" ").toLowerCase();
  return criteria.excludeKeywords.some((kw) => kw.trim() !== "" && haystack.includes(kw.trim().toLowerCase()));
}

export function computeMatch(offer: JobOffer, criteria: SearchCriteria): MatchResult {
  if (isExcluded(offer, criteria)) {
    return { score: 0, matchedLabels: [], excluded: true };
  }

  const coreWeight = 2;
  const core = coreMatch(offer, criteria);

  let totalWeight = coreWeight;
  let earnedWeight = core.ok ? coreWeight : 0;
  const matchedLabels: string[] = [...core.labels];

  for (const category of CATEGORIES) {
    const weight = criteria.priorities.includes(category.key) ? 2 : 1;
    totalWeight += weight;
    const ok = category.match(offer, criteria);
    if (ok) {
      earnedWeight += weight;
      matchedLabels.push(category.label);
    }
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);
  return { score, matchedLabels, excluded: false };
}

export function priorityLabel(key: PriorityKey): string {
  return PRIORITY_OPTIONS.find((p) => p.key === key)?.label ?? key;
}
