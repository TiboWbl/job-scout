import { z } from "zod";
import type { Criteria, CvSummary } from "@/lib/domain/criteria";
import type { Level } from "@/lib/domain/offer";
import { detectExperienceYears } from "@/lib/domain/signals";
import { getLlm } from "@/lib/llm";

export type JudgeInput = {
  id: string;
  title: string;
  company: string;
  location: string;
  contract: string;
  experienceRequired: number | null;
  description: string;
  // Only a search-engine excerpt could be read: nothing precise may be inferred from it.
  excerpt?: boolean;
};

const foldAccents = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const plural = (n: number) => (n > 1 ? "s" : "");

// Facts shown on a card must be in the posting itself. The detector's reading of the text wins; the
// model's reading counts only with its quote, found word for word in the posting and naming the years.
const squash = (v: string) => foldAccents(v).replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export function verifiedExperience(
  asked: string | null,
  required: number | null,
  description: string,
  quote: string | null = null,
): { label: string | null; years: number | null } {
  if (required !== null) return { label: required === 0 ? "Débutant accepté" : `${required} an${plural(required)} et plus`, years: required };
  const text = squash(description);
  if (quote && text.includes(squash(quote))) {
    const years = detectExperienceYears(quote);
    if (years !== null) return { label: years === 0 ? "Débutant accepté" : `${years} an${plural(years)} et plus`, years };
  }
  if (asked && !/\d/.test(asked) && /debutant|premiere experience|jeune diplome|junior|graduate|entry[- ]level|no experience|sans experience/.test(text)) return { label: asked, years: null };
  return { label: null, years: null };
}

// The contract type the model read, kept only if its quote is in the posting and names that contract.
const CONTRACT_WORDS: Record<string, RegExp> = {
  cdi: /\b(cdi|permanent|indetermin)/,
  cdd: /\b(cdd|fixed[- ]term|determin)/,
  stage: /\b(stage|stagiaire|intern(ship)?)\b/,
  alternance: /\b(alternan|apprenti|work[- ]study)/,
  freelance: /\b(freelance|independant|contractor)/,
};
export function verifiedContract(contract: string | null, quote: string | null, description: string): string | null {
  const c = contract?.toLowerCase().trim() ?? "";
  if (!quote || !CONTRACT_WORDS[c]) return null;
  return squash(description).includes(squash(quote)) && CONTRACT_WORDS[c].test(squash(quote)) ? c : null;
}

export function verifiedSalary(salary: string | null, description: string): string | null {
  if (!salary) return null;
  const text = description.replace(/[\s\u00a0\u202f]/g, "");
  const numbers = salary.replace(/[\s\u00a0\u202f]/g, "").match(/\d+/g);
  return numbers && numbers.every((n) => text.includes(n)) ? salary : null;
}

export type Judgement = {
  level: Level;
  missions: string[];
  salary: string | null;
  experience_asked: string | null;
  // Years asked, when verified in the posting: the engine applies the experience gate with it.
  experience_years: number | null;
  // Contract type read by the model with a verified quote: the engine applies the contract gate with it.
  contract_found: string | null;
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
  missions: List,
  salaire: Text,
  experience_demandee: Text,
  citation_experience: Text,
  contrat: Text,
  citation_contrat: Text,
  en_bref: Text,
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
- "correspondance" : les missions réelles sont-elles celles d'un des métiers visés ou de leurs variantes ("metier_vise"), d'un métier passerelle du profil ou de la même famille, ou d'un poste au contact du produit et des utilisateurs dans un secteur prioritaire ("passerelle"), ou d'autre chose ("autre") ? Un intitulé présent dans les listes du profil, avec les missions habituelles de ce métier, n'est jamais "autre", même si le poste est très opérationnel ou demande plus d'expérience. Le domaine du produit (cloud, sécurité, IA, finance…) ne change pas le métier : il joue seulement sur "secteur" et score_interet.
- "secteur" : le secteur de l'entreprise est-il "prioritaire", "accepte", "a_eviter" ou "autre" pour la personne ?
- "piege" : une phrase de 12 mots maximum si l'intitulé est trompeur (missions sans rapport avec le titre, poste commercial déguisé, métier d'un autre domaine sous un intitulé familier), sinon null.
- "deal_breaker" : une phrase de 12 mots maximum si l'offre heurte un deal-breaker du profil, sinon null.

Scores, entiers de 0 à 100 (jamais sur 10) :
- score_interet : alignement avec ce que la personne cherche (missions, secteur). Bas si "autre" ou piège. Plus haut si l'entreprise fait partie de ses entreprises favorites. Tiens compte de ses retours : rapproche-toi des offres qu'elle a appréciées, éloigne-toi de celles qu'elle a écartées et de leurs raisons.
- score_chances : expérience demandée vs réelle, compétences requises vs CV, langues. Chaque année demandée au-delà de l'expérience de la personne baisse ce score. L'expérience ne change jamais la correspondance.
- score_tremplin : valeur comme étape de carrière (apprentissage, encadrement, passerelle).

Si "extrait_seulement" est vrai, tu n'as qu'un extrait de l'offre : remplis "missions", "salaire" et "experience_demandee" seulement avec ce qui y est écrit, sinon [] ou null, et commence "points_d_attention" par « Extrait seulement : lis l'offre complète ».

Rédige en français, en texte brut sans Markdown (pas d'astérisques), tutoiement, ton bienveillant et factuel.
- "pourquoi" : une phrase concrète de 25 mots maximum, sans répéter l'intitulé ni l'entreprise.
- "missions" : les 2 ou 3 missions principales du poste, 8 mots maximum chacune (ex. « Piloter la roadmap de l'app patient »).
- "salaire" : le salaire tel qu'il est écrit dans l'offre (ex. « 45-55 k€ brut annuel »), sinon null. N'estime jamais.
- "experience_demandee" : l'expérience minimale demandée, lue partout dans l'offre (profil recherché, must-haves, requirements, qualifications…), en 5 mots maximum (ex. « 3 ans et plus », « Première expérience acceptée »), sinon null.
- "citation_experience" : la phrase exacte de l'offre, recopiée mot pour mot, qui indique cette expérience (ex. « 3+ years in product management »), sinon null.
- "contrat" : le type de contrat proposé par l'offre, "cdi", "cdd", "stage", "alternance" ou "freelance", sinon null ; "citation_contrat" : la phrase exacte de l'offre qui l'indique, sinon null.
- "en_bref" : la raison principale en 12 mots maximum (ex. « Poste commercial, pas de produit » ou « Produit digital santé, équipe structurée »).
- "points_d_attention" contient le piège s'il y en a un. Listes de 0 à 2 éléments de 10 mots maximum.
Réponds uniquement avec {"resultats": [{"id", "correspondance", "secteur", "piege", "deal_breaker", "missions", "salaire", "experience_demandee", "citation_experience", "contrat", "citation_contrat", "en_bref", "score_interet", "score_chances", "score_tremplin", "pourquoi", "points_forts", "points_d_attention", "leviers_cv"}]} avec un élément par offre reçue, dans le même ordre.`;

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

function profileBrief(criteria: Criteria, cv: CvSummary | null, experienceYears: number | null, favorites: string[] = [], feedback: Feedback = { liked: [], disliked: [] }) {
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
    entreprises_favorites: favorites,
    ...(feedback.liked.length ? { offres_appreciees: feedback.liked } : {}),
    ...(feedback.disliked.length ? { offres_ecartees_par_la_personne: feedback.disliked } : {}),
    cv: cv ? { postes: cv.roles, competences: cv.skills, formation: cv.education, realisations: cv.highlights } : null,
  });
}

// What the person told Scout about earlier offers: kept, applied to, or set aside with a reason.
export type Feedback = { liked: string[]; disliked: string[] };

export async function judgeBatch(
  offers: JudgeInput[],
  criteria: Criteria,
  cv: CvSummary | null,
  experienceYears: number | null,
  favorites: string[] = [],
  feedback: Feedback = { liked: [], disliked: [] },
): Promise<Map<string, Judgement>> {
  const llm = getLlm();

  const shortIds = new Map(offers.map((o, i) => [`o${i + 1}`, o.id]));
  const user = `Profil :\n${profileBrief(criteria, cv, experienceYears, favorites, feedback)}\n\nOffres :\n${offers
    .map((o, i) =>
      JSON.stringify({
        id: `o${i + 1}`,
        intitule: o.title,
        entreprise: o.company,
        lieu: o.location,
        contrat: o.contract,
        experience_demandee_detectee: o.experienceRequired,
        ...(o.excerpt ? { extrait_seulement: true } : {}),
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
    const input = offers.find((o) => o.id === id)!;
    const experience = verifiedExperience(item.experience_demandee, input.experienceRequired, input.description, item.citation_experience);
    const facts: Facts = { match: item.correspondance, sector: item.secteur, trap: item.piege, dealBreaker: item.deal_breaker, chances: item.score_chances };
    const { level, reason } = deriveLevel(facts, criteria);
    const [interet, chances, tremplin] = to100(item, level);
    const watch = item.piege && !item.points_d_attention.includes(item.piege) ? [item.piege, ...item.points_d_attention] : item.points_d_attention;
    results.set(id, {
      level,
      missions: item.missions.slice(0, 3),
      salary: verifiedSalary(item.salaire, input.description),
      experience_asked: experience.label,
      experience_years: experience.years,
      contract_found: verifiedContract(item.contrat, item.citation_contrat, input.description),
      score_interet: interet,
      score_chances: chances,
      score_tremplin: tremplin,
      why: item.pourquoi,
      strengths: item.points_forts.slice(0, 3),
      watch: watch.slice(0, 3),
      cv_levers: item.leviers_cv.slice(0, 3),
      excluded_reason: level === "ecartee" ? (reason ?? (item.en_bref ? plain(item.en_bref) : item.pourquoi)) : null,
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
