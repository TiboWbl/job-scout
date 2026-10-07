import { Criteria } from "@/lib/domain/criteria";
import { titleRelevance } from "@/lib/scoring/relevance";
import type { Place } from "@/lib/domain/offer";
import { placeLabel } from "@/lib/format";
import type { Skill } from "@/lib/scoring/judge";
import { topSkills } from "@/lib/views/skills";
import { getUser } from "@/lib/supabase/server";
import { CvCheck, type HistoryRow, type OfferOption } from "./cv-check";

export const metadata = { title: "Mon CV" };

export default async function CvPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria_version, cv_summary, cv_skills").eq("id", user!.id).single();
  const { data: profileCriteria } = await supabase.from("profiles").select("criteria").eq("id", user!.id).single();
  const [history, applications, scored] = await Promise.all([
    supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(12),
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
  // Every offer read for the search that is the role sought (by its title) or kept in the selection: not
  // only the selection, never the unrelated roles read at a favourite company.
  const { data: read } = await supabase.from("offer_scores").select("level, offer:offers(title, skills, archived_at)").eq("user_id", user!.id).eq("criteria_version", profile?.criteria_version ?? 0).eq("scored_by", "llm").limit(2000);
  type ReadRow = { level: string; offer: { title: string; skills: Skill[] | null; archived_at: string | null } | null };
  const criteria = Criteria.parse(profileCriteria?.criteria ?? {});
  const base = ((read ?? []) as unknown as ReadRow[]).filter((r) => r.offer && !r.offer.archived_at && (r.level !== "ecartee" || titleRelevance(r.offer.title, criteria) >= 5));
  const demand = topSkills(base.map((r) => ({ skills: r.offer!.skills })), cvText, 8, Array.isArray(profile?.cv_skills) ? (profile!.cv_skills as string[]) : []);
  return <CvCheck demand={demand} hasCv={cvText.length > 0} history={(history.data ?? []) as HistoryRow[]} offers={options} initialOfferId={offre ?? null} />;
}
