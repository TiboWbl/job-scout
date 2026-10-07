import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { compareKeywords, scoreCv } from "@/lib/cv/ats";
import { Criteria } from "@/lib/domain/criteria";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { redactPersonalData } from "@/lib/privacy/redact";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().max(60_000),
  layout: z.object({ pages: z.number().int().min(0).max(50), columnRatio: z.number().min(0).max(1), spacedTitles: z.number().int().min(0).max(500) }),
  filename: z.string().max(200).default(""),
  sizeBytes: z.number().int().min(0).max(50_000_000),
  offerId: z.string().uuid().optional(),
});

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 1).map((x) => x.trim()) : []);

// The role's keywords, asked once per set of roles and kept: the same CV always gets the same score.
const KEYWORDS_SYSTEM = `Pour un métier visé, donne les 12 compétences, outils ou méthodes que les offres de ce métier demandent le plus souvent, en 1 ou 2 mots, sous leur forme la plus courante dans les offres (ex. « roadmap », « backlog », « discovery », « SQL », « A/B test », « Jira », « OKR »). Pas de qualités générales (communication, rigueur). Réponds uniquement avec {"mots_cles": [...]}.`;

const SUGGEST_SYSTEM = `Tu aides à améliorer un CV (données personnelles retirées) pour un métier visé. Réponds uniquement avec {"suggestions": [{"ligne", "proposition", "pourquoi"}]} :
jusqu'à 3 lignes d'expérience du CV (des missions, jamais la formation ni les compétences) qui gagneraient le plus à être réécrites. "ligne" : la ligne exacte du CV, recopiée mot pour mot. "proposition" : la même ligne réécrite avec un verbe d'action et un résultat ; n'invente aucun chiffre, écris [chiffre] là où la personne doit mettre le sien. "pourquoi" : en une phrase, ce que la réécriture apporte à un recruteur pour ce métier. Si une ligne est déjà bonne, ne la propose pas ; s'il n'y a rien à améliorer, renvoie une liste vide.`;

const OFFER_SYSTEM = `Tu lis une offre d'emploi. Réponds uniquement avec {"mots_cles": [...], "ajustements": [...]} :
- "mots_cles" : les 10 à 12 compétences, outils, méthodes ou expériences que l'offre demande, en 1 ou 2 mots chacun, recopiés tels qu'écrits dans l'offre.
- "ajustements" : 3 conseils concrets et courts pour adapter un CV à cette offre (quoi mettre en avant, quel intitulé reprendre), sans rien inventer sur la personne.`;

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
    const cached = profile?.cv_keywords as { roles?: string; keywords?: string[] } | null;
    let keywords = cached?.roles === roles ? (cached.keywords ?? []) : [];
    if (keywords.length === 0) {
      keywords = strings(((await llm.json({ system: KEYWORDS_SYSTEM, user: `Métier visé : ${roles}`, tier: "fast" })) as { mots_cles?: unknown }).mots_cles).slice(0, 12);
      if (keywords.length) await supabase.from("profiles").update({ cv_keywords: { roles, keywords } }).eq("id", user.id);
    }
    const result = scoreCv({ text, layout, filename, sizeBytes }, { expected: keywords });
    const read = text.trim().length >= 300 ? ((await llm.json({ system: SUGGEST_SYSTEM, user: `Métier visé : ${roles}\n\nCV :\n${redacted}`, tier: "fast" })) as { suggestions?: unknown }) : {};
    // A suggestion counts only if its line is really in the CV.
    const cv = fold(text);
    const suggestions = (Array.isArray(read.suggestions) ? read.suggestions : [])
      .filter((s): s is { ligne: string; proposition: string; pourquoi?: string } => typeof s?.ligne === "string" && typeof s?.proposition === "string" && s.ligne.length > 15)
      .filter((s) => cv.includes(fold(s.ligne)))
      .map((s) => ({ ligne: s.ligne, proposition: s.proposition, pourquoi: typeof s.pourquoi === "string" ? s.pourquoi : null }))
      .slice(0, 3);

    let comparison: { title: string; company: string; score: number; present: string[]; missing: string[]; tips: string[] } | null = null;
    if (offerId) {
      const { data: offer } = await supabase.from("offers").select("title, description, company:companies(name)").eq("id", offerId).single();
      if (offer?.description) {
        const read = (await llm.json({ system: OFFER_SYSTEM, user: `${offer.title}\n\n${offer.description.slice(0, 8000)}`, tier: "fast" })) as { mots_cles?: unknown; ajustements?: unknown };
        // Keywords kept only if they are written in the offer.
        const keywords = strings(read.mots_cles).filter((k) => fold(offer.description!).includes(fold(k))).slice(0, 12);
        comparison = { title: offer.title, company: (offer.company as unknown as { name: string } | null)?.name ?? "", ...compareKeywords(text, keywords), tips: strings(read.ajustements).slice(0, 3) };
      }
    }

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
      })
      .select("id, created_at")
      .single();
    return NextResponse.json({ id: saved?.id ?? null, createdAt: saved?.created_at ?? null, result, suggestions, comparison });
  } catch (error) {
    console.error("cv analysis failed:", (error as Error).name);
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "L'analyse n'a pas abouti, réessaie." }, { status: 500 });
  }
}
