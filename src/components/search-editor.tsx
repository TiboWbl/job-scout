import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getUser } from "@/lib/supabase/server";
import { SearchSetup } from "@/components/search-setup";

// The person's search, editable: what they wrote, their CV, the criteria understood from it.
export async function SearchEditor() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria, search_text, cv_summary, cv_filename, cv_updated_at").eq("id", user!.id).single();
  const parsed = Criteria.safeParse(profile?.criteria ?? {});
  // What the person's own choices told Scout: the same signals the sort reads for the next offers.
  const [{ data: actions }, { count: applied }] = await Promise.all([
    supabase.from("user_offers").select("saved, dismissed, dismiss_reason").eq("user_id", user!.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
  ]);
  const kept = (actions ?? []).filter((a) => a.saved).length + (applied ?? 0);
  const reasons = new Map<string, number>();
  for (const a of actions ?? []) if (a.dismissed) reasons.set(a.dismiss_reason ?? "Sans raison", (reasons.get(a.dismiss_reason ?? "Sans raison") ?? 0) + 1);
  const dismissed = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const cv = CvSummary.safeParse(profile?.cv_summary);
  return (
    <>
      {(kept > 0 || dismissed.length > 0) && (
        <section className="mb-6 rounded-[22px] border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Ce que Scout a compris de toi</h2>
          <p className="mt-1 text-sm text-muted">Tes choix sur les offres comptent pour classer les prochaines.</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[13.5px]">
            {kept > 0 && <li className="rounded-full bg-mint-soft px-3 py-1.5 font-medium text-mint-ink">{kept} gardée{kept > 1 ? "s" : ""} ou candidature{kept > 1 ? "s" : ""}</li>}
            {dismissed.map(([reason, n]) => (
              <li key={reason} className="rounded-full bg-peach-soft px-3 py-1.5 font-medium text-peach-ink">
                {n} écartée{n > 1 ? "s" : ""} : {reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      <SearchSetup
        mode="edit"
        initialText={profile?.search_text ?? ""}
        initialCriteria={parsed.success ? parsed.data : null}
        initialCvSummary={cv.success ? cv.data : null}
        savedCv={cv.success ? { filename: profile?.cv_filename ?? null, updatedAt: profile?.cv_updated_at ?? null } : null}
      />
    </>
  );
}
