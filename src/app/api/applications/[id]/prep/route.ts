import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { focusedExcerpt, profileBrief } from "@/lib/scoring/judge";

export const maxDuration = 60;

const SYSTEM = `Tu prépares un entretien d'embauche avec une personne. Tu reçois son profil (sans données personnelles), ce qu'elle cherche et le poste.
Réponds uniquement avec {"presentation": "...", "questions": [{"question": "...", "preparer": "..."}]}, en français, texte brut, sans tiret cadratin :
- "presentation" : sa réponse à « Présentez-vous », à dire à l'oral en une à deux minutes (160 à 230 mots), à la première personne. Dans l'ordre : qui elle est en une phrase, deux ou trois étapes réelles de son parcours avec ce qu'elle y a fait, pourquoi ce poste et cette entreprise (seulement d'après le poste fourni), ce qu'elle veut y apporter. Phrases courtes, faciles à dire. Commence par « Je suis » suivi du métier, sans prénom. Aucune formule creuse (« passionné », « dynamique », « regard frais »), aucun accord de genre (écris « je suis Product Owner », jamais « une Product Owner »). N'invente rien : reprends les faits du profil, ou écris [à compléter].
- "questions" : les 4 questions les plus probables pour ce poste, tirées de ses missions et exigences. "preparer" : en une phrase, en tutoyant, ce qu'il faut préparer pour y répondre (un exemple précis de son parcours, un chiffre, une recherche sur l'entreprise).`;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\s*—\s*/g, ", ").trim();

// Once the interview is obtained: the self-introduction and the questions to prepare, on demand.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { supabase, user } = auth;
  const { data: app } = await supabase.from("applications").select("title, company, offer_id, prep").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Candidature introuvable." }, { status: 404 });
  if (app.prep) return NextResponse.json(app.prep);
  const [{ data: profile }, { data: offer }] = await Promise.all([
    supabase.from("profiles").select("criteria, cv_summary, search_text").eq("id", user.id).single(),
    app.offer_id ? supabase.from("offers").select("description").eq("id", app.offer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary).data ?? null;
  const posting = offer?.description ? `\n${focusedExcerpt(offer.description)}` : "\n(L'annonce n'est pas disponible : appuie-toi sur l'intitulé.)";
  try {
    const raw = (await getLlm().json({
      system: SYSTEM,
      user: `Profil :\n${profileBrief(criteria, cv, criteria.experienceYears ?? cv?.experienceYears ?? null)}\n\nPoste : ${app.title} chez ${app.company}${posting}`,
      tier: "fast",
    })) as { presentation?: unknown; questions?: unknown };
    const text = fold(`${app.title} ${offer?.description ?? ""}`);
    // A question must come from the post: one of its meaningful words is written there.
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
      .filter((q): q is { question: string; preparer?: string } => typeof q?.question === "string")
      .filter((q) => fold(q.question).split(/[^a-z0-9]+/).some((w) => w.length >= 6 && text.includes(w)))
      .map((q) => ({ question: clean(q.question), preparer: typeof q.preparer === "string" ? clean(q.preparer) : "" }))
      .slice(0, 4);
    const prep = { presentation: typeof raw.presentation === "string" ? clean(raw.presentation) : "", questions };
    if (!prep.presentation) return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
    await supabase.from("applications").update({ prep }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json(prep);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
  }
}
