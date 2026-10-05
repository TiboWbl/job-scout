import type { Criteria } from "@/lib/domain/criteria";
import { CONTRACT_LABELS } from "@/lib/domain/criteria";
import { zoneVerdict } from "@/lib/domain/geo";
import type { Place, Remote } from "@/lib/domain/offer";
import { titleSeniorityYears } from "@/lib/domain/signals";

// Hard constraints are gates, never points: an offer that breaks one is set aside, whatever
// its other qualities. Only safe exclusions live here; everything else is the LLM's job.

export type GateInput = {
  title: string;
  companyName: string;
  places: Place[];
  remote: Remote;
  remote_scope: string[];
  contract: string;
  experience_min_years: number | null;
};

export type GateResult =
  | { pass: true; outOfZone: boolean; notes: string[] }
  | { pass: false; reason: string };

// Gap (required − real) at which an offer is excluded rather than scored lower.
const EXPERIENCE_GAP_EXCLUDE = 5;
// An intitulé whose implied seniority exceeds real experience by this much is clearly out of reach.
const TITLE_GAP_EXCLUDE = 3;

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function plural(n: number) {
  return n > 1 ? "s" : "";
}

export function prefilter(offer: GateInput, criteria: Criteria, experienceYears: number | null): GateResult {
  const notes: string[] = [];

  if (criteria.companiesAvoid.some((c) => norm(c) && norm(offer.companyName).includes(norm(c)))) {
    return { pass: false, reason: `${offer.companyName} fait partie des entreprises que tu évites.` };
  }

  let outOfZone = false;
  const zone = zoneVerdict(offer, criteria.zone);
  if (zone === "out") {
    if (criteria.outOfZone === "never") return { pass: false, reason: "Hors de ta zone de recherche." };
    if (criteria.outOfZone === "exceptional") outOfZone = true;
  } else if (zone === "unknown") {
    notes.push("Lieu à vérifier sur l'annonce.");
  }

  if (criteria.contracts.length > 0 && offer.contract !== "unknown" && !criteria.contracts.includes(offer.contract as Criteria["contracts"][number])) {
    return { pass: false, reason: `${CONTRACT_LABELS[offer.contract as keyof typeof CONTRACT_LABELS] ?? offer.contract}, un type de contrat que tu n'as pas retenu.` };
  }

  if (experienceYears !== null) {
    const implied = titleSeniorityYears(offer.title);
    if (implied - experienceYears >= TITLE_GAP_EXCLUDE) {
      return { pass: false, reason: `Intitulé trop senior pour ton expérience (${experienceYears} an${plural(experienceYears)}).` };
    }
    const required = offer.experience_min_years;
    if (required !== null && required - experienceYears >= EXPERIENCE_GAP_EXCLUDE) {
      return { pass: false, reason: `${required} an${plural(required)} d'expérience demandé${plural(required)}, ${experienceYears} de ton côté.` };
    }
  }

  return { pass: true, outOfZone, notes };
}
