import type { Contract } from "./criteria";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Order matters: an internship mentioning "CDI possible à l'issue" is still an internship.
const CONTRACT_PATTERNS: [RegExp, Contract][] = [
  [/\b(stage|stagiaire|internship|intern)\b/, "stage"],
  [/\b(alternance|alternant|apprenti|apprentissage|apprenticeship|work[- ]study|contrat pro)\b/, "alternance"],
  [/\b(freelance|independant|contractor|portage)\b/, "freelance"],
  [/\b(cdd|fixed[- ]term|temporary contract|contrat a duree determinee|interim)\b/, "cdd"],
  [/\b(cdi|permanent|contrat a duree indeterminee|full[- ]time)\b/, "cdi"],
];

// In prose, only explicit statements count: "première expérience (stage ou alternance acceptés)"
// describes the candidate, not the contract, and must not turn a CDI into an internship.
const DESCRIPTION_PATTERNS: [RegExp, Contract][] = [
  [/\b(cdi|contrat a duree indeterminee)\b/, "cdi"],
  [/\b(cdd|contrat a duree determinee|fixed[- ]term contract)\b/, "cdd"],
  [/\b(offre de stage|stage de \d+ ?mois|stage d'une duree|stage de fin d'etudes de \d+|\d+[- ]month internship|internship of \d+)\b/, "stage"],
  [/\b(contrat d'alternance|alternance (de|sur) \d+|contrat d'apprentissage|contrat de professionnalisation)\b/, "alternance"],
  [/\b(mission freelance|contrat freelance|freelance mission)\b/, "freelance"],
];

// `explicit` is a structured field from the source (e.g. Lever "commitment"); it wins over prose.
export function detectContract(title: string, explicit?: string | null, description = ""): Contract | "unknown" {
  for (const text of [explicit ?? "", title]) {
    const n = norm(text);
    if (!n) continue;
    for (const [re, contract] of CONTRACT_PATTERNS) if (re.test(n)) return contract;
  }
  const d = norm(description.slice(0, 4000));
  for (const [re, contract] of DESCRIPTION_PATTERNS) if (re.test(d)) return contract;
  return "unknown";
}

const EXPERIENCE_PATTERNS = [
  /(\d{1,2})\s*(?:\+|ou plus)?\s*(?:(?:a|-|to|–)\s*\d{1,2}\s*)?(?:ans|annees?)\s+(?:minimum\s+)?(?:d['’ ]\s*)?(?:experience|exp\b)/g,
  /(?:minimum|au moins|at least)\s+(\d{1,2})\s*(?:ans|annees?|years?)/g,
  /(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?years?\s+(?:of\s+)?(?:\w+\s+){0,3}experience/g,
  /experience\s+(?:de\s+|of\s+)?(\d{1,2})\s*\+?\s*(?:ans|years?)/g,
];

// Lowest number of years the offer asks for, or null when it doesn't say.
export function detectExperienceYears(description: string): number | null {
  const n = norm(description);
  let min: number | null = null;
  for (const re of EXPERIENCE_PATTERNS) {
    for (const m of n.matchAll(re)) {
      const years = Number(m[1]);
      if (Number.isFinite(years) && years <= 20 && (min === null || years < min)) min = years;
    }
  }
  return min;
}

// Minimum experience an intitulé implies, used only as a coarse, safe gate.
export function titleSeniorityYears(title: string): number {
  const n = norm(title);
  if (/\b(vp|vice[- ]president|chief|cpo|cto|director|directeur|directrice|head of|head)\b/.test(n)) return 8;
  if (/\b(principal|staff|group product manager)\b/.test(n)) return 7;
  if (/\b(senior|sr\.?|lead|confirme|confirmee|experimente|experimentee)\b/.test(n)) return 4;
  return 0;
}
