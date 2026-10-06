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
  // A title saying "Intern" or "Alternance" beats a generic "Full-time" ATS field.
  const t = norm(title);
  for (const [re, contract] of CONTRACT_PATTERNS) if (contract !== "cdi" && re.test(t)) return contract;
  for (const text of [explicit ?? "", title]) {
    const n = norm(text);
    if (!n) continue;
    for (const [re, contract] of CONTRACT_PATTERNS) if (re.test(n)) return contract;
  }
  const d = norm(description.slice(0, 4000));
  for (const [re, contract] of DESCRIPTION_PATTERNS) if (re.test(d)) return contract;
  return "unknown";
}

// A number of years, alone or as a range: "3", "3+", "3 ou plus", "3-5", "3 à 5".
// A number of years, alone or as a range: "3", "3+", "3 ou plus", "3-5", "3 à 5" (the upper bound is captured).
const YEARS = String.raw`(\d{1,2})\s*(?:\+|ou plus|or more)?\s*(?:(?:a|-|to|–)\s*(\d{1,2})\s*\+?\s*)?`;
const UNIT = String.raw`(?:ans?|annees?|years?|yrs?)\b['’]?`;
// What follows the years when they describe the candidate's experience, not the company's history.
const CONTEXT = String.raw`(?:in|as|of|on|at|working|within|en|dans|comme|chez|sur|d['’ ]?|de|minimum|min\b|(?:\w+\s+){0,3}experience|(?:\w+\s+){0,3}exp\b)`;
// Each pattern: [regex, index of the lower bound, index of the upper bound or null, implicit lower bound].
const EXPERIENCE_PATTERNS: [RegExp, number, number | null, number | null][] = [
  [new RegExp(`${YEARS}${UNIT}\\s+(?:minimum\\s+)?(?:d['’ ]\\s*)?(?:experience|exp\\b)`, "g"), 1, 2, null],
  [/(?:minimum|au moins|at least|min\.?)\s+(?:de\s+)?(\d{1,2})\s*\+?\s*(?:ans?|annees?|years?|yrs?)\b/g, 1, null, null],
  [/experience\s+(?:de\s+|of\s+|minimum\s+de\s+|d['’ ]au moins\s+)?(\d{1,2})\s*\+?\s*(?:(?:a|-|to|–)\s*(\d{1,2})\s*)?(?:ans?|annees?|years?|yrs?)\b/g, 1, 2, null],
  // "3+ years in product management", "5 years as a PM", "3 ans en gestion de produit", "2 ans sur un poste similaire"
  [new RegExp(`${YEARS}${UNIT}\\s+${CONTEXT}`, "g"), 1, 2, null],
  // "entre 2 et 5 ans d'expérience", "between 2 and 5 years": without it, "5 ans d'expérience" alone was read.
  [/(?:entre|between)\s+(\d{1,2})\s*(?:ans?|annees?|years?)?\s*(?:et|and|a|-|–)\s*(\d{1,2})\s*(?:ans?|annees?|years?|yrs?)\b/g, 1, 2, null],
  // "jusqu'à 2 ans d'expérience", "up to 2 years", "moins de 3 ans": a ceiling, so from 0.
  [/(?:jusqu['’ ]?a|up to|moins de|less than|maximum|max\.?)\s+(\d{1,2})\s*(?:ans?|annees?|years?|yrs?)\b/g, 0, 1, 0],
];
// Years that describe the company or a past period, never a requirement.
const NOT_A_REQUIREMENT = /(?:depuis|since|founded|fondee?|cree+e?|il y a|ago|over the (?:past|last)|for the (?:past|last)|pendant|during|age|old|garantie|guarantee|anniversaire)\s*(?:\w+\s+){0,2}$/;

export type ExperienceRange = { min: number | null; max: number | null };

// The experience the offer asks for: the lowest requirement found, with its upper bound if it gives one.
export function detectExperience(description: string): ExperienceRange {
  const n = norm(description);
  let best: ExperienceRange = { min: null, max: null };
  for (const [re, minIndex, maxIndex, implicitMin] of EXPERIENCE_PATTERNS) {
    for (const m of n.matchAll(re)) {
      const before = n.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (NOT_A_REQUIREMENT.test(before)) continue;
      const min = implicitMin ?? Number(m[minIndex]);
      const rawMax = maxIndex !== null && m[maxIndex] !== undefined ? Number(m[maxIndex]) : null;
      const max = rawMax !== null && rawMax >= min && rawMax <= 20 ? rawMax : null;
      if (!Number.isFinite(min) || min > 15) continue;
      if (best.min === null || min < best.min || (min === best.min && best.max === null && max !== null)) best = { min, max };
    }
  }
  return best;
}

// Without a number, the words still say a lot: "profil junior" or "première expérience" is within a
// beginner's reach, "expérience significative" is not. Junior wins when both appear ("junior ou confirmé").
export type ExperienceLevel = "junior" | "experienced";
const JUNIOR_TEXT =
  /\b(profils? junior|junior accepte|postes? junior|peu experimente|premiere experience|1ere experience|jeune diplome|debutant|sortie? d['’ ]ecole|fraichement diplome|entry[- ]level|new grad|graduate program|recent graduate|no (prior )?experience (is )?required|early[- ]career)/;
const EXPERIENCED_TEXT =
  /\b(experience (professionnelle )?(significative|solide|confirmee|averee|reussie|consequente|importante|approfondie|probante)|(solide|forte|riche|longue|vraie) experience|profils? (confirme|experimente|senior)|vous etes experimente|tu es experimente|plusieurs annees d['’ ]experience|significant experience|extensive experience|proven (track record|experience)|strong (track record|experience)|seasoned|several years of experience|experienced (product|professional|pm))/;

export function detectExperienceLevel(description: string): ExperienceLevel | null {
  const n = norm(description);
  if (JUNIOR_TEXT.test(n)) return "junior";
  if (EXPERIENCED_TEXT.test(n)) return "experienced";
  return null;
}

// Years an "experienced" profile implies, used only for the gap (never shown as a number).
export const EXPERIENCED_YEARS = 3;

// Lowest number of years the offer asks for, or null when it doesn't say.
export function detectExperienceYears(description: string): number | null {
  return detectExperience(description).min;
}

// "0 à 2 ans", "3 à 6 ans", "3 ans et plus", "Débutant accepté": how a range reads on a card.
export function experienceLabel(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  if (max !== null && max > min) return `${min} à ${max} ans`;
  if (min === 0) return "Débutant accepté";
  return `${min} an${min > 1 ? "s" : ""} et plus`;
}

// The card's reading: the years when the posting gives them, otherwise its own words.
export function experienceText(min: number | null, max: number | null, level: ExperienceLevel | null | undefined): string | null {
  return experienceLabel(min, max) ?? (level === "junior" ? "Profil junior accepté" : level === "experienced" ? "Expérience significative demandée" : null);
}

// Minimum experience an intitulé implies, used only as a coarse, safe gate.
export function titleSeniorityYears(title: string): number {
  const n = norm(title);
  if (/\b(vp|vice[- ]president|chief|cpo|cto|director|directeur|directrice|head of|head)\b/.test(n)) return 8;
  if (/\b(principal|staff|group product manager)\b/.test(n)) return 7;
  // People-management roles need experience whatever the field.
  if (/\b(engineering manager|manager, engineering|manager i+, engineering|people manager|team lead|tech lead)\b/.test(n)) return 5;
  if (/\b(senior|sr\.?|lead|expert)\b/.test(n)) return 5;
  // Levelled titles (e.g. "Architect 3", "Engineer III").
  if (/\b(iii|iv|v)\b|\s[3-5]\s*$|\s[3-5]\s*[-–(]/.test(n)) return 5;
  if (/\b(confirme|confirmee|confirmed|experimente|experimentee|experienced|ii)\b|\s2\s*$|\s2\s*[-–(,]/.test(n)) return 3;
  return 0;
}
