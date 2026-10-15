import type { SupabaseClient } from "@supabase/supabase-js";

// Reliability measured, not assumed: the admin's spot checks of the sort (on their own selection, so no
// one else's data is shown) and what people flag as wrong. Needs the service role.

export type CheckCandidate = { offerId: string; title: string; company: string; url: string; level: string; why: string | null };
export type CheckStats = { n: number; right: number; byLevel: { level: string; n: number; right: number }[] };
export type Report = { id: string; field: string; comment: string | null; createdAt: string; offerId: string; title: string; company: string; url: string };

const DAY = 86_400_000;

// One offer the model sorted for the admin, picked at random among those not checked yet.
export async function nextCheck(db: SupabaseClient, userId: string): Promise<CheckCandidate | null> {
  const { data: profile } = await db.from("profiles").select("criteria_version").eq("id", userId).single();
  const version = profile?.criteria_version ?? 0;
  const { data: done } = await db.from("sort_checks").select("offer_id").eq("user_id", userId);
  const checked = new Set((done ?? []).map((d) => d.offer_id as string));
  const ids: { offer_id: string; level: string }[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await db.from("offer_scores").select("offer_id, level").eq("user_id", userId).eq("criteria_version", version).eq("scored_by", "llm").range(f, f + 999);
    ids.push(...((data ?? []) as typeof ids));
    if (!data || data.length < 1000) break;
  }
  const pool = ids.filter((r) => !checked.has(r.offer_id));
  for (let attempt = 0; attempt < 5 && pool.length; attempt++) {
    const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const [{ data: score }, { data: offer }] = await Promise.all([
      db.from("offer_scores").select("why, excluded_reason").eq("user_id", userId).eq("criteria_version", version).eq("offer_id", pick.offer_id).single(),
      db.from("offers").select("title, apply_url, archived_at, company:companies(name)").eq("id", pick.offer_id).single(),
    ]);
    if (!offer || offer.archived_at) continue;
    return { offerId: pick.offer_id, title: offer.title, company: (offer.company as unknown as { name: string } | null)?.name ?? "", url: offer.apply_url, level: pick.level, why: pick.level === "ecartee" ? score?.excluded_reason ?? null : score?.why ?? null };
  }
  return null;
}

export async function checkStats(db: SupabaseClient, userId: string): Promise<CheckStats> {
  const { data } = await db.from("sort_checks").select("level, right_call").eq("user_id", userId).gte("checked_at", new Date(Date.now() - 90 * DAY).toISOString());
  const rows = data ?? [];
  const levels = ["coeur", "solide", "tremplin", "ecartee"];
  return {
    n: rows.length,
    right: rows.filter((r) => r.right_call).length,
    byLevel: levels.map((level) => ({ level, n: rows.filter((r) => r.level === level).length, right: rows.filter((r) => r.level === level && r.right_call).length })).filter((l) => l.n > 0),
  };
}

export async function openReports(db: SupabaseClient): Promise<Report[]> {
  const { data } = await db.from("offer_reports").select("id, field, comment, created_at, offer_id, offer:offers(title, apply_url, company:companies(name))").is("resolved_at", null).order("created_at", { ascending: false }).limit(40);
  return ((data ?? []) as unknown as { id: string; field: string; comment: string | null; created_at: string; offer_id: string; offer: { title: string; apply_url: string; company: { name: string } | null } | null }[]).map((r) => ({
    id: r.id,
    field: r.field,
    comment: r.comment,
    createdAt: r.created_at,
    offerId: r.offer_id,
    title: r.offer?.title ?? "Offre supprimée",
    company: r.offer?.company?.name ?? "",
    url: r.offer?.apply_url ?? "",
  }));
}
