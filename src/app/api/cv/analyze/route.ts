import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { compareKeywords, hasKeyword, scoreCv } from "@/lib/cv/ats";
import { cvSkillsFrom } from "@/lib/views/skills";
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

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 1).map((x) => x.trim()) : []);

// The role's keywords, asked once per set of roles and kept: the same CV always gets the same score.
const KEYWORDS_SYSTEM = `Pour un métier visé, donne les 12 compétences, outils ou méthodes que les offres de ce métier demandent le plus souvent, en 1 ou 2 mots, sous leur forme la plus courante dans les offres (ex. « roadmap », « backlog », « discovery », « SQL », « A/B test », « Jira », « OKR »). Pas de qualités générales (communication, rigueur). Réponds uniquement avec {"mots_cles": [...]}.`;

// The recruiter's reading: what convinces, what is missing, how to tailor. Every strength quotes the CV,
// every gap of an offer quotes the offer, and Scout drops what it cannot find: nothing is invented.
const RECRUITER_SYSTEM = `Tu es recruteur. Tu lis un CV (données personnelles retirées) pour un poste cible, et tu dis franchement, sans flatter ni sévérité gratuite, comment il se présente. Réponds uniquement avec {"avis", "atouts", "manques", "personnaliser", "lignes"} :
- "avis" : un texte de 2 phrases au plus, ce qu'un recruteur retient de ce CV pour ce poste et si le profil serait convoqué en entretien. Juge au niveau du poste cible : un poste junior n'attend pas l'expérience d'un confirmé.
- "atouts" : 2 ou 3 objets {"point", "citation_cv"} : ce qui convaincrait un recruteur pour ce poste. "citation_cv" : un seul passage du CV qui le prouve à lui seul, recopié mot pour mot.
- "manques" : 0 à 3 objets {"point", "citation_poste"} : ce que le poste attend et que le CV ne montre pas. Ne cite jamais un manque si le CV en parle. "citation_poste" : s'il y a une offre, les mots de l'offre qui le demandent, recopiés mot pour mot ; sinon, le mot-clé exact de la liste « demandé par les offres du métier ».
- "personnaliser" : 2 ou 3 actions concrètes pour adapter ce CV à ce poste (quoi remonter, quel intitulé ou quels mots reprendre, quoi raccourcir), en une phrase chacune. N'invente rien sur la personne.
- "lignes" : jusqu'à 3 lignes de missions du CV (jamais la formation ni les compétences) qui gagneraient le plus à être réécrites pour ce poste, en objets {"ligne", "proposition", "pourquoi"}. "ligne" : recopiée mot pour mot. "proposition" : toujours la ligne réécrite, au même temps que le reste du CV, avec un verbe d'action et un résultat ; n'invente aucun chiffre, écris [chiffre] là où la personne doit mettre le sien. "pourquoi" : une phrase. Liste vide si tout est déjà bon.
Écris en français, en tutoyant la personne, sans tiret cadratin.`;

// Keywords of one offer, for the ATS comparison: written in the offer, checked word for word in the CV.
const OFFER_SYSTEM = `Tu lis une offre d'emploi. Réponds uniquement avec {"mots_cles": [...]} : les 10 à 12 compétences, outils, méthodes ou expériences que l'offre demande, en 1 ou 2 mots chacun, recopiés tels qu'écrits dans l'offre.`;

type Recruiter = { target: string; avis: string; atouts: { point: string; citation: string }[]; manques: { point: string; citation: string | null }[]; conseils: string[] };
const quoted = (whole: string, part: unknown) => typeof part === "string" && part.trim().length >= 8 && fold(whole).includes(fold(part.trim().replace(/^[«"“]\s*|\s*[»"”]$/g, "")));
const objects = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : []);

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

    const { data: offer } = offerId ? await supabase.from("offers").select("title, description, company:companies(name)").eq("id", offerId).single() : { data: null };
    const company = (offer?.company as unknown as { name: string } | null)?.name ?? "";
    const offerText = offer?.description ? offer.description.slice(0, 8000) : null;
    const target = offer && offerText ? `${offer.title}${company ? ` chez ${company}` : ""}` : roles;
    const level = criteria.experienceYears !== null ? `, ${criteria.experienceYears} an${criteria.experienceYears > 1 ? "s" : ""} d'expérience` : "";
    const brief =
      offer && offerText
        ? `Poste cible : l'offre ci-dessous.\n\nOFFRE : ${offer.title}${company ? ` · ${company}` : ""}\n${offerText}`
        : `Poste cible : ${roles} (métier visé, pas d'offre précise)${level}.\nDemandé par les offres du métier : ${keywords.join(", ")}.`;

    let recruiter: Recruiter | null = null;
    let suggestions: { ligne: string; proposition: string; pourquoi: string | null }[] = [];
    if (text.trim().length >= 300) {
      const read = (await llm.json({ system: RECRUITER_SYSTEM, user: `${brief}\n\nCV :\n${redacted}`, tier: "fast" })) as Record<string, unknown>;
      const cv = fold(text);
      const missingKeyword = (k: unknown) => {
        const parts = typeof k === "string" ? k.split(/,| et /).map((x) => x.trim()).filter(Boolean) : [];
        return parts.length > 0 && parts.every((p) => keywords.some((w) => fold(w) === fold(p)) && !hasKeyword(cv, p));
      };
      recruiter = {
        target,
        avis: (typeof read.avis === "string" ? read.avis : strings(read.avis).join(" ")).trim().slice(0, 600),
        // A strength counts only with its proof in the CV, a gap of an offer only with its words in the offer.
        atouts: objects(read.atouts)
          .filter((x) => typeof x.point === "string" && quoted(text, x.citation_cv))
          .map((x) => ({ point: String(x.point), citation: String(x.citation_cv).trim() }))
          .slice(0, 3),
        manques: objects(read.manques)
          // Without an offer, a gap must be one of the role's keywords, and really absent from the CV.
          .filter((x) => typeof x.point === "string" && (offerText ? quoted(offerText, x.citation_poste) : missingKeyword(x.citation_poste)))
          .map((x) => ({ point: String(x.point), citation: offerText ? String(x.citation_poste).trim() : null }))
          .slice(0, 3),
        conseils: strings(read.personnaliser).map((c) => c.replace(/\*\*/g, "")).slice(0, 3),
      };
      // A rewrite counts only if its line is really in the CV.
      suggestions = objects(read.lignes)
        .filter((x): x is { ligne: string; proposition: string; pourquoi?: unknown } => typeof x.ligne === "string" && typeof x.proposition === "string" && x.ligne.length > 15)
        .filter((x) => cv.includes(fold(x.ligne)))
        .map((x) => ({ ligne: x.ligne, proposition: x.proposition, pourquoi: typeof x.pourquoi === "string" ? x.pourquoi : null }))
        .slice(0, 3);
    }

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
    await supabase.from("profiles").update({ cv_skills: cvSkillsFrom(text, names) }).eq("id", user.id);

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
