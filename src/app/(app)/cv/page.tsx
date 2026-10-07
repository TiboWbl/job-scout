import type { Place } from "@/lib/domain/offer";
import { placeLabel } from "@/lib/format";
import { getUser } from "@/lib/supabase/server";
import { CvCheck, type HistoryRow, type OfferOption } from "./cv-check";

export const metadata = { title: "Mon CV" };

export default async function CvPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria_version").eq("id", user!.id).single();
  const [history, applications, scored] = await Promise.all([
    supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("applications").select("offer_id").eq("user_id", user!.id).not("offer_id", "is", null),
    supabase
      .from("offer_scores")
      .select("level, score_interet, offer:offers(id, title, location_raw, places, archived_at, company:companies(name))")
      .eq("user_id", user!.id)
      .eq("criteria_version", profile?.criteria_version ?? 0)
      .neq("level", "ecartee")
      .order("score_interet", { ascending: false })
      .limit(400),
  ]);
  // Every offer of the selection can be compared; those in the tracking come first.
  const tracked = new Set((applications.data ?? []).map((a) => a.offer_id as string));
  type Row = { level: OfferOption["level"]; offer: { id: string; title: string; location_raw: string | null; places: Place[]; archived_at: string | null; company: { name: string } | null } | null };
  const options: OfferOption[] = ((scored.data ?? []) as unknown as Row[])
    .filter((r) => r.offer && !r.offer.archived_at)
    .map((r) => ({ id: r.offer!.id, title: r.offer!.title, company: r.offer!.company?.name ?? "", place: placeLabel(r.offer!.places, r.offer!.location_raw), level: r.level, tracked: tracked.has(r.offer!.id) }))
    .sort((a, b) => Number(b.tracked) - Number(a.tracked));
  return <CvCheck history={(history.data ?? []) as HistoryRow[]} offers={options} initialOfferId={offre ?? null} />;
}
