import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoryRow, OfferOption } from "@/app/(app)/cv/cv-check";
import type { Place } from "@/lib/domain/offer";
import { placeLabel } from "@/lib/format";
import type { Skill } from "@/lib/scoring/judge";

// What the CV page needs, for the app and the demo alike: the saved analyses and the offers to target.
export async function loadCvPage(supabase: SupabaseClient, userId: string): Promise<{ history: HistoryRow[]; offers: OfferOption[] }> {
  const { data: profile } = await supabase.from("profiles").select("criteria_version, cv_summary, cv_skills").eq("id", userId).single();
  const [history, applications, scored] = await Promise.all([
    supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison, recruiter").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
    supabase.from("applications").select("offer_id").eq("user_id", userId).not("offer_id", "is", null),
    supabase
      .from("offer_scores")
      .select("level, score_interet, offer:offers(id, title, location_raw, places, archived_at, skills, company:companies(name))")
      .eq("user_id", userId)
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
  return { history: (history.data ?? []) as HistoryRow[], offers: options };
}
