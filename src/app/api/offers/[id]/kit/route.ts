import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { focusedExcerpt, profileBrief } from "@/lib/scoring/judge";

export const maxDuration = 60;

const SYSTEM = `Tu prépares une candidature avec une personne. Tu reçois son profil (sans données personnelles) et une offre.
Réponds uniquement avec {"message": "...", "questions": [{"question": "...", "preparer": "..."}]} en français, tutoiement pour "preparer", texte brut sans mise en forme :
- "message" : le message de candidature que la personne enverra (vouvoiement du recruteur, 70 à 110 mots). Il cite une mission précise de l'offre, relie un fait réel de son profil, et finit par une proposition d'échange. Aucune formule creuse (« passionné », « dynamique »). Sans formule d'appel ni signature. Écris sans accord de genre (« je serais heureux » devient « ce serait un plaisir »). N'invente aucune expérience, aucun chiffre : reprends ceux du profil, ou écris [à compléter] là où un détail manque.
- "questions" : les 4 questions d'entretien les plus probables pour ce poste, tirées des missions et exigences de l'offre. "preparer" : en une phrase, ce que la personne doit préparer pour y répondre (un exemple de son parcours, un chiffre, une recherche sur l'entreprise).`;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\s*—\s*/g, ", ").trim();

// On demand, never during the sort. Kept on the person's score for the next opening.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", user.id).single();
  const version = profile?.criteria_version ?? 0;
  const { data: score } = await supabase.from("offer_scores").select("kit").eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version).maybeSingle();
  if (score?.kit) return NextResponse.json(score.kit);
  const { data: offer } = await supabase.from("offers").select("title, description, company:companies(name)").eq("id", id).single();
  if (!offer?.description) return NextResponse.json({ error: "L'annonce complète n'a pas pu être lue : prépare-toi depuis son site." }, { status: 404 });
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary).data ?? null;
  try {
    const raw = (await getLlm().json({
      system: SYSTEM,
      user: `Profil :\n${profileBrief(criteria, cv, criteria.experienceYears ?? cv?.experienceYears ?? null)}\n\nOffre : ${offer.title} (${(offer.company as unknown as { name: string } | null)?.name ?? ""})\n${focusedExcerpt(offer.description)}`,
      tier: "fast",
    })) as { message?: unknown; questions?: unknown };
    const text = fold(offer.description);
    // A question must come from the offer: at least one of its meaningful words is written there.
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
      .filter((q): q is { question: string; preparer?: string } => typeof q?.question === "string")
      .filter((q) => fold(q.question).split(/[^a-z0-9]+/).some((w) => w.length >= 6 && text.includes(w)))
      .map((q) => ({ question: clean(q.question), preparer: typeof q.preparer === "string" ? clean(q.preparer) : "" }))
      .slice(0, 4);
    const kit = { message: typeof raw.message === "string" ? clean(raw.message) : "", questions };
    if (!kit.message && questions.length === 0) return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
    await supabase.from("offer_scores").update({ kit }).eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version);
    return NextResponse.json(kit);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
  }
}
