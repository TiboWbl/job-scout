import type { Criteria } from "@/lib/domain/criteria";

// Cheap lexical pre-sort before the LLM, to decide in which order offers get scored within the
// rate limit. Not an exact-keyword gate: partial title overlap and description mentions count.

const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "a", "the", "of", "and", "for", "h", "f", "x", "m", "w"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function phraseScore(phrase: string, titleTokens: Set<string>, text: string): { title: number; body: number } {
  const ptoks = tokens(phrase);
  if (ptoks.length === 0) return { title: 0, body: 0 };
  const inTitle = ptoks.filter((t) => titleTokens.has(t)).length / ptoks.length;
  const body = text.includes(ptoks.join(" ")) ? 1 : 0;
  return { title: inTitle >= 0.99 ? 1 : inTitle >= 0.5 ? 0.5 : 0, body };
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
