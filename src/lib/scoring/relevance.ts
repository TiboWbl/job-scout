import type { Criteria } from "@/lib/domain/criteria";

// Cheap lexical pre-sort before the LLM, to decide in which order offers get scored within the
// rate limit. Not an exact-keyword gate: partial title overlap and description mentions count.

const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "a", "the", "of", "and", "for", "h", "f", "x", "m", "w"]);

// Abbreviations and their spelled-out forms are the same words for the pre-sort.
const SYNONYMS: [RegExp, string][] = [
  [/\bquality assurance\b/g, "qa"],
  [/\bproduct owner\b/g, "product owner po"],
  [/\bproduct manager\b/g, "product manager pm"],
  [/\buser experience\b/g, "ux"],
  [/\buser interface\b/g, "ui"],
];

function tokens(s: string): string[] {
  let text = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [re, add] of SYNONYMS) text = text.replace(re, (m) => `${m} ${add}`);
  return text
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

// Words shared by countless job titles; a match on them alone says nothing about the role.
const GENERIC = new Set([
  "manager", "junior", "senior", "associate", "lead", "chef", "responsable", "head", "officer", "specialist", "specialiste",
  "charge", "chargee", "consultant", "assistant", "assistante", "director", "directeur", "directrice", "intern", "stagiaire",
  "alternant", "alternante", "confirme", "confirmee", "jr", "sr", "ii", "iii", "i",
]);

function phraseScore(phrase: string, titleTokens: Set<string>, text: string): { title: number; body: number } {
  const all = tokens(phrase);
  if (all.length === 0) return { title: 0, body: 0 };
  const distinctive = all.filter((t) => !GENERIC.has(t));
  const ptoks = distinctive.length > 0 ? distinctive : all;
  const inTitle = ptoks.filter((t) => titleTokens.has(t)).length / ptoks.length;
  const body = text.includes(all.join(" ")) ? 1 : 0;
  // "Product" alone in "FP&A Business Partner – Tech & Product" is weaker than the full "Product Manager".
  const genericMissing = all.some((t) => GENERIC.has(t) && !titleTokens.has(t));
  const full = genericMissing ? 0.75 : 1;
  return { title: inTitle >= 0.99 ? full : inTitle >= 0.5 ? 0.5 : 0, body };
}

export function relevance(title: string, description: string, criteria: Criteria): number {
  const titleTokens = new Set(tokens(title));
  const text = tokens(`${title} ${description}`).join(" ");
  let score = 0;

  const best = (phrases: string[], titleWeight: number, bodyWeight: number) => {
    let top = 0;
    for (const p of phrases) {
      const s = phraseScore(p, titleTokens, text);
      top = Math.max(top, s.title * titleWeight + s.body * bodyWeight);
    }
    return top;
  };

  score += best([...criteria.targetRoles, ...criteria.titleVariants], 10, 3);
  score += best(criteria.bridgeRoles, 6, 2);
  score += best([...criteria.sectorsPriority, ...criteria.sectorsOk], 0, 1.5);
  return score;
}

// Title-only match against the roles sought and bridges. Deciding which offers reach the LLM on the
// description would send nearly everything: "work closely with product managers" is everywhere.
// "QA avec évolution vers le produit" is searched as "QA": qualifiers never appear in job titles.
const core = (phrase: string) => phrase.split(/\s+(?:orient[ée]e?s?|avec|en|pour|vers|dans|with|towards)\s/i)[0].replace(/\s*\(.*$/, "");

export function titleRelevance(title: string, criteria: Criteria): number {
  const titleTokens = new Set(tokens(title));
  let top = 0;
  for (const p of [...criteria.targetRoles, ...criteria.titleVariants]) top = Math.max(top, phraseScore(core(p), titleTokens, "").title * 10);
  for (const p of criteria.bridgeRoles) top = Math.max(top, phraseScore(core(p), titleTokens, "").title * 6);
  return top;
}

// The title names a role sought word for word ("Healthcare Product Manager Junior" names "Product
// Manager"). Multi-word phrases only: acronyms like "PM" or "PO" are too ambiguous to settle it.
export function namesTargetRole(title: string, criteria: Criteria): boolean {
  const t = ` ${tokens(title).join(" ")} `;
  return [...criteria.targetRoles, ...criteria.titleVariants].some((p) => {
    const words = tokens(core(p));
    return words.length >= 2 && t.includes(` ${words.join(" ")} `);
  });
}
