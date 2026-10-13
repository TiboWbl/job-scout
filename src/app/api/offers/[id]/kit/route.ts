import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { focusedExcerpt, profileBrief } from "@/lib/scoring/judge";

export const maxDuration = 60;

const RULES = `Vouvoiement du recruteur. Aucune formule creuse (« passionné », « dynamique », « je me permets »). Écris sans accord de genre (« je serais heureux » devient « ce serait un plaisir »). N'invente aucune expérience, aucun chiffre, rien sur l'entreprise qui ne soit dans l'offre : reprends les faits du profil, ou écris [à compléter] là où un détail manque. Texte brut, sans mise en forme, sans tiret cadratin.`;

const PROMPTS = {
  message: `Tu prépares une candidature avec une personne. Tu reçois son profil (sans données personnelles) et une offre.
Réponds uniquement avec {"texte": "..."} : le court message de candidature qu'elle enverra (70 à 110 mots). Il cite une mission précise de l'offre, relie un fait réel de son profil, et finit par une proposition d'échange. Sans formule d'appel ni signature. ${RULES}`,
  letter: `Tu prépares une candidature avec une personne. Tu reçois son profil (sans données personnelles) et une offre.
Réponds uniquement avec {"texte": "..."} : sa lettre de motivation : 4 paragraphes de 2 ou 3 phrases chacun, séparés par une ligne vide, 300 mots au plus en tout. 1. Pourquoi ce poste dans cette entreprise, en s'appuyant sur ce que dit l'offre. 2. Deux expériences réelles du profil qui répondent aux missions, avec leurs résultats. 3. Ce que la personne veut apporter et apprendre dans ce poste. 4. Une conclusion qui propose un échange. Commence par « Madame, Monsieur, », termine par « Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. » sans signature. ${RULES}`,
} as const;

const Body = z.object({ part: z.enum(["message", "letter"]).default("message") });
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\s*—\s*/g, ", ").trim();

// What to send when applying: a short message, and the cover letter when the offer asks for one.
// Each is prepared on demand (one model call), kept with the person's score for the next opening.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { part } = Body.parse(await request.json().catch(() => ({})));
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", user.id).single();
  const version = profile?.criteria_version ?? 0;
  const { data: score } = await supabase.from("offer_scores").select("kit").eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version).maybeSingle();
  const kit = (score?.kit ?? {}) as { message?: string; letter?: string };
  if (kit[part]) return NextResponse.json(kit);
  const { data: offer } = await supabase.from("offers").select("title, description, company:companies(name)").eq("id", id).single();
  if (!offer?.description) return NextResponse.json({ error: "L'annonce complète n'a pas pu être lue : prépare-toi depuis son site." }, { status: 404 });
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary).data ?? null;
  try {
    const raw = (await getLlm().json({
      system: PROMPTS[part],
      user: `Profil :\n${profileBrief(criteria, cv, criteria.experienceYears ?? cv?.experienceYears ?? null)}\n\nOffre : ${offer.title} (${(offer.company as unknown as { name: string } | null)?.name ?? ""})\n${focusedExcerpt(offer.description)}`,
      tier: "fast",
    })) as { texte?: unknown };
    const text = typeof raw.texte === "string" ? clean(raw.texte) : "";
    if (!text) return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
    const next = { ...kit, [part]: text };
    if (score) await supabase.from("offer_scores").update({ kit: next }).eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version);
    return NextResponse.json(next);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
  }
}
