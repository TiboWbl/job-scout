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

const ROLE_SYSTEM = `Tu aides à vérifier un CV (données personnelles retirées) pour un métier visé.
Réponds uniquement avec {"mots_cles": [...], "suggestions": [{"ligne", "proposition"}]} :
- "mots_cles" : 10 à 12 compétences, outils ou méthodes que les offres de ce métier demandent le plus souvent, en 1 ou 2 mots, sous leur forme la plus courante dans les offres (ex. « roadmap », « backlog », « discovery », « SQL », « A/B test », « Jira »).
- "suggestions" : jusqu'à 3 lignes d'expérience du CV (des missions, jamais la formation ni les compétences) à améliorer. "ligne" : la ligne exacte du CV, recopiée mot pour mot. "proposition" : la même ligne réécrite avec un verbe d'action et un résultat ; n'invente aucun chiffre, écris [chiffre] là où la personne doit mettre le sien.`;

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

  const { data: profile } = await supabase.from("profiles").select("criteria").eq("id", user.id).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const meta = user.user_metadata ?? {};
  const knownNames = [meta.full_name, meta.name, meta.given_name, meta.family_name].filter((n): n is string => typeof n === "string");
  // The model only ever sees the CV without name and contact details.
  const redacted = redactPersonalData(text, knownNames).slice(0, 12_000);

  try {
    const llm = getLlm();
    const roles = [...criteria.targetRoles, ...criteria.titleVariants.slice(0, 4)].join(", ") || "le métier de la personne";
    const role = text.trim().length >= 300 ? ((await llm.json({ system: ROLE_SYSTEM, user: `Métier visé : ${roles}\n\nCV :\n${redacted}`, tier: "fast" })) as { mots_cles?: unknown; suggestions?: unknown }) : {};
    const result = scoreCv({ text, layout, filename, sizeBytes }, { expected: strings(role.mots_cles) });
    // A suggestion counts only if its line is really in the CV.
    const cv = fold(text);
    const suggestions = (Array.isArray(role.suggestions) ? role.suggestions : [])
      .filter((s): s is { ligne: string; proposition: string } => typeof s?.ligne === "string" && typeof s?.proposition === "string" && s.ligne.length > 15)
      .filter((s) => cv.includes(fold(s.ligne)))
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

    await supabase.from("cv_analyses").insert({
      user_id: user.id,
      filename: filename.slice(0, 200),
      total: result.total,
      categories: result.categories.map((c) => ({ key: c.key, score: c.score, max: c.max })),
    });
    return NextResponse.json({ result, suggestions, comparison });
  } catch (error) {
    console.error("cv analysis failed:", (error as Error).name);
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "L'analyse n'a pas abouti, réessaie." }, { status: 500 });
  }
}
