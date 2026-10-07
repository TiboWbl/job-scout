import { getUser } from "@/lib/supabase/server";
import { CvCheck, type HistoryRow, type OfferOption } from "./cv-check";

export const metadata = { title: "Mon CV" };

export default async function CvPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria_version").eq("id", user!.id).single();
  const [history, applications, best] = await Promise.all([
    supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("applications").select("offer_id, title, company").eq("user_id", user!.id).not("offer_id", "is", null).order("updated_at", { ascending: false }).limit(15),
    supabase
      .from("offer_scores")
      .select("offer:offers(id, title, archived_at, company:companies(name))")
      .eq("user_id", user!.id)
      .eq("criteria_version", profile?.criteria_version ?? 0)
      .in("level", ["coeur", "solide"])
      .order("score_interet", { ascending: false })
      .limit(15),
  ]);
  // The offers worth adapting the CV to: those in the tracking first, then the best matches.
  const options: OfferOption[] = [];
  for (const a of applications.data ?? []) options.push({ id: a.offer_id as string, label: `${a.title} · ${a.company}`, group: "Dans ton suivi" });
  for (const r of (best.data ?? []) as unknown as { offer: { id: string; title: string; archived_at: string | null; company: { name: string } | null } | null }[]) {
    if (r.offer && !r.offer.archived_at && !options.some((o) => o.id === r.offer!.id)) options.push({ id: r.offer.id, label: `${r.offer.title} · ${r.offer.company?.name ?? ""}`, group: "Tes meilleures offres" });
  }
  return <CvCheck history={(history.data ?? []) as HistoryRow[]} offers={options} initialOfferId={offre ?? null} />;
}
