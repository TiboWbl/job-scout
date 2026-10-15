import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { compareKeywords, scoreCv } from "@/lib/cv/ats";
import { fold, KEYWORDS_SYSTEM, readAsRecruiter, strings, type Recruiter, type Suggestion } from "@/lib/cv/recruiter";
import { cvSkillsFrom, inCvCheck } from "@/lib/views/skills";
import { marketForCv } from "@/lib/market/view";
import { Criteria } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { redactPersonalData } from "@/lib/privacy/redact";

export const maxDuration = 120;

const Body = z.object({
  text: z.string().max(60_000),
  layout: z.object({ pages: z.number().int().min(0).max(50), columnRatio: z.number().min(0).max(1), spacedTitles: z.number().int().min(0).max(500) }),
  filename: z.string().max(200).default(""),
  sizeBytes: z.number().int().min(0).max(50_000_000),
  offerId: z.string().uuid().optional(),
});


// Keywords of one offer, for the ATS comparison: written in the offer, checked word for word in the CV.
const OFFER_SYSTEM = `Tu lis une offre d'emploi. Réponds uniquement avec {"mots_cles": [...]} : les 10 à 12 compétences, outils, méthodes ou expériences que l'offre demande, en 1 ou 2 mots chacun, recopiés tels qu'écrits dans l'offre.`;

// Scores a CV against Scout's grid, optionally compares it with one offer. Keeps only the scores.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Fichier illisible.");
  const { text, layout, filename, sizeBytes, offerId } = body.data;
  const { supabase, user } = auth;

  const { data: profile } = await supabase.from("profiles").select("criteria, cv_keywords").eq("id", user.id).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const meta = user.user_metadata ?? {};
  const knownNames = [meta.full_name, meta.name, meta.given_name, meta.family_name].filter((n): n is string => typeof n === "string");
  // The model only ever sees the CV without name and contact details.
  const redacted = redactPersonalData(text, knownNames).slice(0, 12_000);

  try {
    const llm = getLlm();
    const roles = [...criteria.targetRoles, ...criteria.titleVariants.slice(0, 4)].join(", ") || "le métier de la personne";
    // The role's keywords are the twelve skills Mon marché counted in the offers, checked in the CV the
    // same way: the two pages give the same list and the same verdict. The model's guess is only a
    // fallback, when no market can be computed yet.
    const market = await marketForCv(supabase, user.id);
    const top = market.skills;
    const has = inCvCheck(text, []);
    let keywords = top.map((t) => t.name);
    const present = top.length ? top.filter((t) => has(t.key)).map((t) => t.name) : undefined;
    const cached = profile?.cv_keywords as { roles?: string; keywords?: string[] } | null;
    if (keywords.length === 0 && cached?.roles === roles) keywords = cached.keywords ?? [];
    if (keywords.length === 0) {
      keywords = strings(((await llm.json({ system: KEYWORDS_SYSTEM, user: `Métier visé : ${roles}`, tier: "fast" })) as { mots_cles?: unknown }).mots_cles).slice(0, 12);
      if (keywords.length) await supabase.from("profiles").update({ cv_keywords: { roles, keywords } }).eq("id", user.id);
    }
    // The role's titles as the offers write them; the person's own when no market is computed yet.
    const titles = market.titles.length ? market.titles : [...criteria.targetRoles, ...criteria.titleVariants].slice(0, 3).map((title) => ({ title, count: 0 }));
    const result = scoreCv(
      { text, layout, filename, sizeBytes },
      { expected: keywords, present, titles, languages: top.filter((t) => t.kind === "langue").map((t) => t.name), keys: Object.fromEntries(top.map((t) => [t.name, t.key])), shares: Object.fromEntries(top.map((t) => [t.name, t.share])) },
    );

    const { data: offer } = offerId ? await supabase.from("offers").select("title, description, company:companies(name)").eq("id", offerId).single() : { data: null };
    const company = (offer?.company as unknown as { name: string } | null)?.name ?? "";
    const offerText = offer?.description ? offer.description.slice(0, 8000) : null;
    let recruiter: Recruiter | null = null;
    let suggestions: Suggestion[] = [];
    if (text.trim().length >= 300)
      ({ recruiter, suggestions } = await readAsRecruiter(llm, { text, redacted, roles, experienceYears: criteria.experienceYears, keywords, offer: offer && offerText ? { title: offer.title, company, text: offerText } : null }));

    let comparison: { title: string; company: string; score: number; present: string[]; missing: string[]; tips: string[] } | null = null;
    if (offer && offerText) {
      const read = (await llm.json({ system: OFFER_SYSTEM, user: `${offer.title}\n\n${offerText}`, tier: "fast" })) as { mots_cles?: unknown };
      // Keywords kept only if they are written in the offer.
      const keywords = strings(read.mots_cles).filter((k) => fold(offer.description!).includes(fold(k))).slice(0, 12);
      comparison = { title: offer.title, company, ...compareKeywords(text, keywords), tips: [] };
    }

    // Which skills asked by the person's offers this CV mentions: kept (the CV itself is not).
    const { data: asked } = await supabase.from("offer_scores").select("offer:offers(skills)").eq("user_id", user.id).eq("scored_by", "llm").limit(1500);
    const names = ((asked ?? []) as unknown as { offer: { skills: { name: string }[] | null } | null }[]).flatMap((r) => (r.offer?.skills ?? []).map((sk) => sk.name));
    await supabase.from("profiles").update({ cv_skills: cvSkillsFrom(text, [...names, ...top.map((t) => t.name)]) }).eq("id", user.id);

    // Kept to be read again later: the grid, the fixes, the rewrites and the comparison, never the CV itself.
    const { data: saved } = await supabase
      .from("cv_analyses")
      .insert({
        user_id: user.id,
        filename: filename.slice(0, 200),
        total: result.total,
        categories: result.categories.map((c) => ({ key: c.key, score: c.score, max: c.max })),
        result,
        suggestions,
        comparison,
        recruiter,
      })
      .select("id, created_at")
      .single();
    return NextResponse.json({ id: saved?.id ?? null, createdAt: saved?.created_at ?? null, result, suggestions, comparison, recruiter });
  } catch (error) {
    console.error("cv analysis failed:", (error as Error).name);
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "L'analyse n'a pas abouti, réessaie." }, { status: 500 });
  }
}
