import { Criteria } from "@/lib/domain/criteria";
import { titleRelevance } from "@/lib/scoring/relevance";
import type { Place } from "@/lib/domain/offer";
import { placeLabel } from "@/lib/format";
import type { Skill } from "@/lib/scoring/judge";
import { skillDemand } from "@/lib/views/skills";
import { getUser } from "@/lib/supabase/server";
import { CvCheck, type HistoryRow, type OfferOption } from "./cv-check";

export const metadata = { title: "Mon CV" };

export default async function CvPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria_version, cv_summary, cv_skills").eq("id", user!.id).single();
  const { data: profileCriteria } = await supabase.from("profiles").select("criteria").eq("id", user!.id).single();
  const [history, applications, scored] = await Promise.all([
    supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison, recruiter").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("applications").select("offer_id").eq("user_id", user!.id).not("offer_id", "is", null),
    supabase
      .from("offer_scores")
      .select("level, score_interet, offer:offers(id, title, location_raw, places, archived_at, skills, company:companies(name))")
      .eq("user_id", user!.id)
      .eq("criteria_version", profile?.criteria_version ?? 0)
      .neq("level", "ecartee")
      .order("score_interet", { ascending: false })
      .limit(400),
  ]);
  // Every offer of the selection can be compared; those in the tracking come first.
  const tracked = new Set((applications.data ?? []).map((a) => a.offer_id as string));
  type Row = { level: OfferOption["level"]; offer: { id: string; title: string; location_raw: string | null; places: Place[]; archived_at: string | null; skills: Skill[] | null; company: { name: string } | null } | null };
  const options: OfferOption[] = ((scored.data ?? []) as unknown as Row[])
    .filter((r) => r.offer && !r.offer.archived_at)
    .map((r) => ({ id: r.offer!.id, title: r.offer!.title, company: r.offer!.company?.name ?? "", place: placeLabel(r.offer!.places, r.offer!.location_raw), level: r.level, tracked: tracked.has(r.offer!.id) }))
    .sort((a, b) => Number(b.tracked) - Number(a.tracked));
  // What the selection asks for most, compared with what Scout kept from the CV.
  const cvSummary = (profile?.cv_summary ?? {}) as Record<string, unknown>;
  const cvText = ["skills", "roles", "highlights", "education", "languages"].flatMap((k) => (Array.isArray(cvSummary[k]) ? (cvSummary[k] as string[]) : [])).join(" · ");
  // What the role asks for: every active offer whose title is the role sought (any level, any contract:
  // that is the market), plus the person's selection. Skills are counted in their full texts.
  const criteria = Criteria.parse(profileCriteria?.criteria ?? {});
  const titles: { id: string; title: string }[] = [];
  const vocabulary: Skill[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await supabase.from("offers").select("id, title, skills").is("archived_at", null).range(f, f + 999);
    for (const o of data ?? []) {
      titles.push({ id: o.id as string, title: o.title as string });
      if (Array.isArray(o.skills)) vocabulary.push(...(o.skills as Skill[]));
    }
    if (!data || data.length < 1000) break;
  }
  const selected = new Set(options.map((o) => o.id));
  const baseIds = titles.filter((o) => selected.has(o.id) || titleRelevance(o.title, criteria) >= 5).map((o) => o.id).slice(0, 800);
  const descriptions: string[] = [];
  for (let i = 0; i < baseIds.length; i += 150) {
    const { data } = await supabase.from("offers").select("description").in("id", baseIds.slice(i, i + 150));
    for (const o of data ?? []) if ((o.description ?? "").length > 300) descriptions.push(o.description as string);
  }
  const demand = skillDemand(descriptions, vocabulary, cvText, Array.isArray(profile?.cv_skills) ? (profile!.cv_skills as string[]) : []);
  // "Dans ton CV": the skills kept at the last analysis, or what was read from the CV given at sign-up.
  const last = history.data?.[0]?.created_at as string | undefined;
  const cvSource = last ? `d'après ta dernière analyse de CV, du ${new Date(last).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : cvText ? "d'après le CV donné à ton inscription" : null;
  return <CvCheck demand={demand} cvSource={cvSource} history={(history.data ?? []) as HistoryRow[]} offers={options} initialOfferId={offre ?? null} />;
}
