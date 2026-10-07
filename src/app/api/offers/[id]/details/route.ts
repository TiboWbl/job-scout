import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { focusedExcerpt, profileBrief } from "@/lib/scoring/judge";

export const maxDuration = 60;

const SYSTEM = `Tu aides une personne à décider si elle postule à une offre. Tu reçois son profil (sans données personnelles) et l'offre.
Réponds uniquement avec {"points_forts": [...], "leviers_cv": [...]} en français, tutoiement, texte brut :
- "points_forts" : 2 ou 3 atouts concrets de la personne pour ce poste, tirés de son profil et de l'offre, 12 mots maximum chacun.
- "leviers_cv" : 2 ou 3 ajustements concrets de son CV pour cette offre (intitulé à reprendre, compétence à remonter, expérience à mettre en avant), 12 mots maximum chacun.
N'invente rien sur la personne.`;

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 2).map((x) => x.replace(/\*\*/g, "").trim()).slice(0, 3) : []);

// Strengths and CV levers are read when the offer is opened, not during the sort: the sort stays short.
// Kept on the person's score, so the next opening is instant.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", user.id).single();
  const { data: score } = await supabase.from("offer_scores").select("strengths, cv_levers, level").eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", profile?.criteria_version ?? 0).maybeSingle();
  if (!score || score.level === "ecartee") return NextResponse.json({ strengths: [], cvLevers: [] });
  if ((score.strengths as string[]).length > 0 || (score.cv_levers as string[]).length > 0) return NextResponse.json({ strengths: score.strengths, cvLevers: score.cv_levers });
  const { data: offer } = await supabase.from("offers").select("title, description, company:companies(name)").eq("id", id).single();
  if (!offer?.description) return NextResponse.json({ strengths: [], cvLevers: [] });
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary).data ?? null;
  try {
    const raw = (await getLlm().json({
      system: SYSTEM,
      user: `Profil :\n${profileBrief(criteria, cv, criteria.experienceYears ?? cv?.experienceYears ?? null)}\n\nOffre : ${offer.title} (${(offer.company as unknown as { name: string } | null)?.name ?? ""})\n${focusedExcerpt(offer.description)}`,
      tier: "fast",
    })) as { points_forts?: unknown; leviers_cv?: unknown };
    const strengths = list(raw.points_forts);
    const cvLevers = list(raw.leviers_cv);
    await supabase.from("offer_scores").update({ strengths, cv_levers: cvLevers }).eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", profile?.criteria_version ?? 0);
    return NextResponse.json({ strengths, cvLevers });
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ strengths: [], cvLevers: [] });
  }
}
