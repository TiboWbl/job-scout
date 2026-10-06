import { z } from "zod";
import type { Criteria, CvSummary } from "@/lib/domain/criteria";
import type { Level } from "@/lib/domain/offer";
import { getLlm } from "@/lib/llm";

export type JudgeInput = {
  id: string;
  title: string;
  company: string;
  location: string;
  contract: string;
  experienceRequired: number | null;
  description: string;
};

export type Judgement = {
  level: Level;
  score_interet: number;
  score_chances: number;
  score_tremplin: number;
  why: string;
  strengths: string[];
  watch: string[];
  cv_levers: string[];
  excluded_reason: string | null;
};

// The model answers factual questions about each offer; the level is derived by a fixed rule
// (deriveLevel), so it stays consistent and explainable even with a small model.
const fold = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_").trim();
const oneOf = <T extends string>(values: readonly T[], fallback: T) =>
  z.string().transform((v) => values.find((x) => fold(v).startsWith(x)) ?? fallback);
const MATCHES = ["metier_vise", "passerelle", "autre"] as const;
const SECTORS = ["prioritaire", "accepte", "a_eviter", "autre"] as const;
type Match = (typeof MATCHES)[number];
type Sector = (typeof SECTORS)[number];

const Score = z.coerce.number().min(0).max(100);
// Plain text only: the cards render text, and models like to add **bold**.
const plain = (v: string) => v.replace(/\*\*|__|`/g, "").replace(/^\s*[-*•]\s+/, "").trim();
const List = z.array(z.string()).nullish().transform((v) => (v ?? []).map(plain).filter(Boolean));
const Text = z.string().nullish().transform((v) => (v && v.trim() && !/^(null|aucun|non|none)$/i.test(v.trim()) ? v.trim() : null));
const Item = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  correspondance: oneOf(MATCHES, "autre"),
  secteur: oneOf(SECTORS, "autre"),
  piege: Text,
  deal_breaker: Text,
  score_interet: Score,
  score_chances: Score,
  score_tremplin: Score,
  pourquoi: z.string().min(1).transform(plain),
  points_forts: List,
  points_d_attention: List,
  leviers_cv: List,
});
type Item = z.infer<typeof Item>;

export type Facts = { match: Match; sector: Sector; trap: string | null; dealBreaker: string | null; chances: number };

// Constraints are gates, not averages: any one of them sets the level on its own.
export function deriveLevel(f: Facts, criteria: Criteria): { level: Level; reason: string | null } {
  if (f.dealBreaker) return { level: "ecartee", reason: f.dealBreaker };
  if (f.sector === "a_eviter") return { level: "ecartee", reason: "Secteur que tu as choisi d'éviter." };
  if (f.trap) return f.match === "passerelle" ? { level: "tremplin", reason: null } : { level: "ecartee", reason: f.trap };
  if (f.match === "autre") return { level: "ecartee", reason: null };
  if (f.match === "passerelle") return { level: "tremplin", reason: null };
  if (f.sector === "autre" && !criteria.otherSectors.open) return { level: "ecartee", reason: "Hors des secteurs que tu vises." };
  return { level: f.sector === "prioritaire" && f.chances >= 50 ? "coeur" : "solide", reason: null };
}

// Some models answer on a 0-10 scale despite the instruction; a relevant offer reveals it.
function to100(item: Item, level: Level) {
  const scores = [item.score_interet, item.score_chances, item.score_tremplin];
  const factor = level !== "ecartee" && scores.every((n) => n <= 10) ? 10 : 1;
  const [interet, chances, tremplin] = scores.map((n) => Math.min(100, Math.round(n * factor)));
  // A bridge is by definition not the role sought: it never outranks it on interest.
  const cap = level === "ecartee" ? 30 : level === "tremplin" ? 55 : 100;
  return [Math.min(interet, cap), chances, tremplin];
}

const SYSTEM = `Tu es le moteur de tri de Scout, un outil qui aide une personne à décrocher un emploi.
Pour chaque offre, juge le POSTE RÉEL décrit par les missions, pas l'intitulé. Lis d'abord la partie « profil recherché / qualifications / requirements ».

Réponds à ces questions pour chaque offre :
- "correspondance" : les missions réelles sont-elles celles d'un des métiers visés ou de leurs variantes ("metier_vise"), d'un métier passerelle du profil ou de la même famille, ou d'un poste au contact du produit et des utilisateurs dans un secteur prioritaire ("passerelle"), ou d'autre chose ("autre") ? Un intitulé présent dans les listes du profil, avec les missions habituelles de ce métier, n'est jamais "autre", même si le poste est très opérationnel ou demande plus d'expérience.
- "secteur" : le secteur de l'entreprise est-il "prioritaire", "accepte", "a_eviter" ou "autre" pour la personne ?
- "piege" : une phrase si l'intitulé est trompeur (missions sans rapport avec le titre, poste commercial déguisé, métier d'un autre domaine sous un intitulé familier), sinon null.
- "deal_breaker" : une phrase si l'offre heurte un deal-breaker du profil, sinon null.

Scores, entiers de 0 à 100 (jamais sur 10) :
- score_interet : alignement avec ce que la personne cherche (missions, secteur). Bas si "autre" ou piège.
- score_chances : expérience demandée vs réelle, compétences requises vs CV, langues. Chaque année demandée au-delà de l'expérience de la personne baisse ce score. L'expérience ne change jamais la correspondance.
- score_tremplin : valeur comme étape de carrière (apprentissage, encadrement, passerelle).

Rédige en français, en texte brut sans Markdown (pas d'astérisques), tutoiement, ton bienveillant et factuel. "pourquoi" : une ou deux phrases concrètes, sans répéter l'intitulé. "points_d_attention" contient le piège s'il y en a un. Listes de 0 à 3 éléments courts.
Réponds uniquement avec {"resultats": [{"id", "correspondance", "secteur", "piege", "deal_breaker", "score_interet", "score_chances", "score_tremplin", "pourquoi", "points_forts", "points_d_attention", "leviers_cv"}]} avec un élément par offre reçue, dans le même ordre.`;

const REQUIREMENTS_HEADER = /^(.{0,40})(profil recherch|ce que nous recherchons|qualifications?|requirements|what we('re| are) looking for|about you|your profile|who you are|you (have|are)|must[- ]have|tu es|vous [eê]tes|comp[ée]tences requises)/im;

// Keeps the requirements section intact even in long descriptions, since chances hinge on it.
export function focusedExcerpt(description: string, max = 3200): string {
  if (description.length <= max) return description;
  const match = REQUIREMENTS_HEADER.exec(description);
  if (!match) return description.slice(0, max);
  const reqStart = match.index;
  const requirements = description.slice(reqStart, reqStart + 1900);
  return `${description.slice(0, max - requirements.length - 20)}\n[…]\n${requirements}`;
}

function profileBrief(criteria: Criteria, cv: CvSummary | null, experienceYears: number | null) {
  return JSON.stringify({
    metiers_vises: criteria.targetRoles,
    variantes: criteria.titleVariants.slice(0, 12),
    passerelles: criteria.bridgeRoles,
    secteurs_prioritaires: criteria.sectorsPriority,
    secteurs_acceptes: criteria.sectorsOk,
    secteurs_a_eviter: criteria.sectorsAvoid,
    autres_secteurs: criteria.otherSectors.open ? (criteria.otherSectors.condition ?? "acceptés") : "refusés",
    contrats: criteria.contracts,
    experience_annees: experienceYears,
    langues: criteria.languages,
    deal_breakers: criteria.dealBreakers,
    cv: cv ? { postes: cv.roles, competences: cv.skills, formation: cv.education, realisations: cv.highlights } : null,
  });
}

export async function judgeBatch(
  offers: JudgeInput[],
  criteria: Criteria,
  cv: CvSummary | null,
  experienceYears: number | null,
): Promise<Map<string, Judgement>> {
  const llm = getLlm();

  const shortIds = new Map(offers.map((o, i) => [`o${i + 1}`, o.id]));
  const user = `Profil :\n${profileBrief(criteria, cv, experienceYears)}\n\nOffres :\n${offers
    .map((o, i) =>
      JSON.stringify({
        id: `o${i + 1}`,
        intitule: o.title,
        entreprise: o.company,
        lieu: o.location,
        contrat: o.contract,
        experience_demandee_detectee: o.experienceRequired,
        description: focusedExcerpt(o.description),
      }),
    )
    .join("\n")}`;

  const raw = await llm.json({ system: SYSTEM, user, tier: "fast" });
  const items = (raw as { resultats?: unknown })?.resultats;
  const results = new Map<string, Judgement>();
  if (!Array.isArray(items)) return results;
  // One malformed offer must not cost the whole batch.
  items.forEach((entry, index) => {
    const parsed = Item.safeParse(entry);
    if (!parsed.success) return;
    const item = parsed.data;
    // Models sometimes echo "1" or "O1" instead of "o1"; the answer order matches the input order.
    const id = shortIds.get(item.id) ?? shortIds.get(`o${item.id.replace(/^o/i, "")}`) ?? (items.length === offers.length ? offers[index].id : undefined);
    if (!id) return;
    const facts: Facts = { match: item.correspondance, sector: item.secteur, trap: item.piege, dealBreaker: item.deal_breaker, chances: item.score_chances };
    const { level, reason } = deriveLevel(facts, criteria);
    const [interet, chances, tremplin] = to100(item, level);
    const watch = item.piege && !item.points_d_attention.includes(item.piege) ? [item.piege, ...item.points_d_attention] : item.points_d_attention;
    results.set(id, {
      level,
      score_interet: interet,
      score_chances: chances,
      score_tremplin: tremplin,
      why: item.pourquoi,
      strengths: item.points_forts.slice(0, 3),
      watch: watch.slice(0, 3),
      cv_levers: item.leviers_cv.slice(0, 3),
      excluded_reason: level === "ecartee" ? (reason ?? item.pourquoi) : null,
    });
  });
  return results;
}

// Ranking weight between the three scores, driven by the openness slider.
export function rank(s: { score_interet: number | null; score_chances: number | null; score_tremplin: number | null }, openness: number) {
  const t = openness / 100;
  const wi = 0.7 - 0.4 * t;
  const wc = 0.2 + 0.25 * t;
  const wt = 0.1 + 0.15 * t;
  return wi * (s.score_interet ?? 0) + wc * (s.score_chances ?? 0) + wt * (s.score_tremplin ?? 0);
}
