import { z } from "zod";
import type { Criteria, CvSummary } from "@/lib/domain/criteria";
import type { Level } from "@/lib/domain/offer";
import { getLlm } from "@/lib/llm";
import { relevance } from "./relevance";

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

const Item = z.object({
  id: z.string(),
  niveau: z.enum(["coeur", "solide", "tremplin", "ecartee"]),
  score_interet: z.number().min(0).max(100),
  score_chances: z.number().min(0).max(100),
  score_tremplin: z.number().min(0).max(100),
  pourquoi: z.string().min(1),
  points_forts: z.array(z.string()).default([]),
  points_d_attention: z.array(z.string()).default([]),
  leviers_cv: z.array(z.string()).default([]),
  raison_ecartee: z.string().nullable().optional(),
});
const Output = z.object({ resultats: z.array(Item) });

const SYSTEM = `Tu es le moteur de tri de Scout, un outil qui aide une personne à décrocher un emploi.
Pour chaque offre, juge le POSTE RÉEL décrit, pas l'intitulé. Lis d'abord la partie « profil recherché / qualifications / requirements » pour estimer les chances.
Pièges à détecter : intitulé trompeur (missions sans rapport avec le titre), poste commercial déguisé, métier d'un autre domaine sous un intitulé familier.

Niveaux :
- "coeur" : le métier visé, dans un secteur prioritaire, et des chances réelles.
- "solide" : le métier visé, autre secteur ou entreprise moins alignée, chances réelles.
- "tremplin" : métier passerelle avec un chemin crédible vers le métier visé.
- "ecartee" : ni le métier visé ni une passerelle crédible, ou un deal-breaker. Donne alors "raison_ecartee" (une phrase).

Scores 0-100 :
- score_interet : alignement avec ce que la personne cherche (métier, missions, secteur).
- score_chances : expérience demandée vs réelle, compétences requises vs CV, langues. Une expérience demandée supérieure à la sienne baisse ce score sans écarter l'offre.
- score_tremplin : valeur comme étape de carrière (apprentissage, encadrement, passerelle).

Rédige en français, tutoiement, ton bienveillant et factuel. "pourquoi" : une ou deux phrases concrètes, sans répéter l'intitulé. Listes de 0 à 3 éléments courts.
Réponds uniquement avec {"resultats": [{"id", "niveau", "score_interet", "score_chances", "score_tremplin", "pourquoi", "points_forts", "points_d_attention", "leviers_cv", "raison_ecartee"}]} avec un élément par offre reçue.`;

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
): Promise<{ results: Map<string, Judgement>; by: "llm" | "mock" }> {
  const llm = getLlm();
  if (!llm) return { results: new Map(offers.map((o) => [o.id, mockJudge(o, criteria, experienceYears)])), by: "mock" };

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
  const parsed = Output.safeParse(raw);
  const results = new Map<string, Judgement>();
  if (!parsed.success) return { results, by: "llm" };
  for (const item of parsed.data.resultats) {
    const id = shortIds.get(item.id);
    if (!id) continue;
    results.set(id, {
      level: item.niveau,
      score_interet: Math.round(item.score_interet),
      score_chances: Math.round(item.score_chances),
      score_tremplin: Math.round(item.score_tremplin),
      why: item.pourquoi,
      strengths: item.points_forts.slice(0, 3),
      watch: item.points_d_attention.slice(0, 3),
      cv_levers: item.leviers_cv.slice(0, 3),
      excluded_reason: item.niveau === "ecartee" ? (item.raison_ecartee ?? item.pourquoi) : null,
    });
  }
  return { results, by: "llm" };
}

// Deterministic stand-in used without an LLM key, so the whole flow stays testable.
export function mockJudge(o: JudgeInput, criteria: Criteria, experienceYears: number | null): Judgement {
  const rel = relevance(o.title, o.description, criteria);
  const interet = Math.min(100, Math.round(rel * 6));
  const gap = o.experienceRequired !== null && experienceYears !== null ? o.experienceRequired - experienceYears : 0;
  const chances = Math.max(10, 80 - Math.max(0, gap) * 15);
  const isTarget = rel >= 10;
  const level: Level = isTarget ? (interet >= 75 ? "coeur" : "solide") : rel >= 6 ? "tremplin" : "ecartee";
  return {
    level,
    score_interet: interet,
    score_chances: chances,
    score_tremplin: isTarget ? 50 : 60,
    why: isTarget
      ? "L'intitulé correspond à un des métiers que tu vises (évaluation automatique, sans LLM)."
      : level === "tremplin"
        ? "Proche d'un de tes métiers passerelles (évaluation automatique, sans LLM)."
        : "Peu de lien avec tes métiers cibles (évaluation automatique, sans LLM).",
    strengths: [],
    watch: gap > 0 ? [`${o.experienceRequired} ans d'expérience demandés`] : [],
    cv_levers: [],
    excluded_reason: level === "ecartee" ? "Peu de lien avec tes métiers cibles." : null,
  };
}

// Ranking weight between the three scores, driven by the openness slider.
export function rank(s: { score_interet: number | null; score_chances: number | null; score_tremplin: number | null }, openness: number) {
  const t = openness / 100;
  const wi = 0.7 - 0.4 * t;
  const wc = 0.2 + 0.25 * t;
  const wt = 0.1 + 0.15 * t;
  return wi * (s.score_interet ?? 0) + wc * (s.score_chances ?? 0) + wt * (s.score_tremplin ?? 0);
}
