import { Criteria, CvSummary } from "@/lib/domain/criteria";
import type { LlmProvider } from "@/lib/llm";
import { focusedExcerpt, profileBrief } from "@/lib/scoring/judge";

// What Scout writes with the person at each step of an application: the message or cover letter to
// send, then the self-introduction and the likely questions once the interview is obtained. Nothing is
// invented: facts come from the profile, "[à compléter]" marks what is missing.

const RULES = `Vouvoiement du recruteur. Aucune formule creuse (« passionné », « dynamique », « je me permets »). Écris sans accord de genre (« je serais heureux » devient « ce serait un plaisir »). N'invente aucune expérience, aucun chiffre, rien sur l'entreprise qui ne soit dans l'offre : reprends les faits du profil, ou écris [à compléter] là où un détail manque. Texte brut, sans mise en forme, sans tiret cadratin.`;

export const KIT_PROMPTS = {
  message: `Tu prépares une candidature avec une personne. Tu reçois son profil (sans données personnelles) et une offre.
Réponds uniquement avec {"texte": "..."} : le court message de candidature qu'elle enverra (70 à 110 mots). Il cite une mission précise de l'offre, relie un fait réel de son profil, et finit par une proposition d'échange. Sans formule d'appel ni signature. ${RULES}`,
  letter: `Tu prépares une candidature avec une personne. Tu reçois son profil (sans données personnelles) et une offre.
Réponds uniquement avec {"texte": "..."} : sa lettre de motivation : 4 paragraphes de 2 ou 3 phrases chacun, séparés par une ligne vide, 300 mots au plus en tout. 1. Pourquoi ce poste dans cette entreprise, en s'appuyant sur ce que dit l'offre. 2. Deux expériences réelles du profil qui répondent aux missions, avec leurs résultats. 3. Ce que la personne veut apporter et apprendre dans ce poste. 4. Une conclusion qui propose un échange. Commence par « Madame, Monsieur, », termine par « Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. » sans signature. ${RULES}`,
} as const;
export type KitPart = keyof typeof KIT_PROMPTS;

const PREP_PROMPT = `Tu prépares un entretien d'embauche avec une personne. Tu reçois son profil (sans données personnelles), ce qu'elle cherche et le poste.
Réponds uniquement avec {"presentation": "...", "questions": [{"question": "...", "preparer": "..."}]}, en français, texte brut, sans tiret cadratin :
- "presentation" : sa réponse à « Présentez-vous », à dire à l'oral en une à deux minutes (160 à 230 mots), à la première personne. Dans l'ordre : qui elle est en une phrase, deux ou trois étapes réelles de son parcours avec ce qu'elle y a fait, pourquoi ce poste et cette entreprise (seulement d'après le poste fourni), ce qu'elle veut y apporter. Phrases courtes, faciles à dire. Commence par « Je suis » suivi du métier, sans prénom. Aucune formule creuse (« passionné », « dynamique », « regard frais »), aucun accord de genre (écris « je suis Product Owner », jamais « une Product Owner »). N'invente rien : reprends les faits du profil, ou écris [à compléter].
- "questions" : les 4 questions les plus probables pour ce poste, tirées de ses missions et exigences. "preparer" : en une phrase, en tutoyant, ce qu'il faut préparer pour y répondre (un exemple précis de son parcours, un chiffre, une recherche sur l'entreprise).`;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Plain text: no markdown emphasis (*word*, **word**), no em dash.
const clean = (s: string) => s.replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1").replace(/\*\*/g, "").replace(/\s*—\s*/g, ", ").trim();

export type ProfileRow = { criteria: unknown; cv_summary: unknown };
function brief(profile: ProfileRow | null) {
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary).data ?? null;
  return profileBrief(criteria, cv, criteria.experienceYears ?? cv?.experienceYears ?? null);
}

export async function writeKit(llm: LlmProvider, profile: ProfileRow | null, offer: { title: string; company: string; description: string }, part: KitPart): Promise<string> {
  const raw = (await llm.json({ system: KIT_PROMPTS[part], user: `Profil :\n${brief(profile)}\n\nOffre : ${offer.title} (${offer.company})\n${focusedExcerpt(offer.description)}`, tier: "fast" })) as { texte?: unknown };
  return typeof raw.texte === "string" ? clean(raw.texte) : "";
}

export type Prep = { presentation: string; questions: { question: string; preparer: string }[] };

export async function writePrep(llm: LlmProvider, profile: ProfileRow | null, post: { title: string; company: string; description: string | null }): Promise<Prep> {
  const posting = post.description ? `\n${focusedExcerpt(post.description)}` : "\n(L'annonce n'est pas disponible : appuie-toi sur l'intitulé.)";
  const raw = (await llm.json({ system: PREP_PROMPT, user: `Profil :\n${brief(profile)}\n\nPoste : ${post.title} chez ${post.company}${posting}`, tier: "fast" })) as { presentation?: unknown; questions?: unknown };
  const text = fold(`${post.title} ${post.description ?? ""}`);
  // A question must come from the post: one of its meaningful words is written there.
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .filter((q): q is { question: string; preparer?: string } => typeof q?.question === "string")
    .filter((q) => fold(q.question).split(/[^a-z0-9]+/).some((w) => w.length >= 6 && text.includes(w)))
    .map((q) => ({ question: clean(q.question), preparer: typeof q.preparer === "string" ? clean(q.preparer) : "" }))
    .slice(0, 4);
  return { presentation: typeof raw.presentation === "string" ? clean(raw.presentation) : "", questions };
}
