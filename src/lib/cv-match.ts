import { JobOffer } from "./types";

const STOPWORDS = new Set([
  "dans", "pour", "avec", "sans", "cette", "cette", "votre", "notre", "vous", "nous", "leurs",
  "plus", "tout", "tous", "toute", "toutes", "ainsi", "comme", "mais", "donc", "chez", "entre",
  "être", "avoir", "fait", "faire", "sont", "cela", "ceci", "elle", "ils", "elles", "leur",
  "qui", "que", "quoi", "dont", "où", "ans", "mois", "jour", "jours", "the", "and", "for", "with",
]);

function significantWords(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const words = normalized.match(/[a-z0-9]{4,}/g) ?? [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}

// A lightweight second signal alongside the criteria-based score: does the CV's own vocabulary
// overlap with what this specific offer is actually asking for. Capped low (max +10) so it
// nudges the ranking rather than overriding the user's explicit criteria.
export function cvOverlapBonus(cvText: string, offer: JobOffer): number {
  if (cvText.trim().length < 50) return 0;

  const cvWords = significantWords(cvText);
  if (cvWords.size === 0) return 0;

  const offerHaystack = significantWords([offer.title, offer.fullDescription, ...offer.tags].join(" "));
  if (offerHaystack.size === 0) return 0;

  let matches = 0;
  for (const word of offerHaystack) {
    if (cvWords.has(word)) matches++;
  }
  const ratio = matches / offerHaystack.size;

  if (ratio >= 0.3) return 10;
  if (ratio >= 0.18) return 6;
  if (ratio >= 0.1) return 3;
  return 0;
}
