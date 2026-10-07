import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria } from "@/lib/domain/criteria";
import { SCORE_SELECT, withoutEngineCopies, type FeedItem } from "@/lib/domain/feed";

// Data for the Offres screen. The same loader serves a signed-in person (their own client, RLS) and
// the public demo (service role, the demo persona's id): every query filters on the user explicitly.
export async function loadFeed(db: SupabaseClient, userId: string) {
  const { data: profile } = await db.from("profiles").select("criteria, criteria_version").eq("id", userId).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const version: number = profile?.criteria_version ?? 0;

  // Set-aside offers are only counted here; the "Écartées" view loads them on demand.
  const [selected, excludedCount, actions, favorites, activeCount, scoredCount] = await Promise.all([
    db.from("offer_scores").select(SCORE_SELECT).eq("user_id", userId).eq("criteria_version", version).neq("level", "ecartee").limit(1500),
    db.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version).eq("level", "ecartee"),
    db.from("user_offers").select("offer_id, saved, dismissed").eq("user_id", userId),
    db.from("favorite_companies").select("company_id").eq("user_id", userId),
    db.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null),
    db.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version),
  ]);

  const actionByOffer = new Map((actions.data ?? []).map((a) => [a.offer_id, a]));
  type Row = Omit<FeedItem, "offer" | "saved" | "dismissed"> & { offer: (FeedItem["offer"] & { archived_at: string | null }) | null };
  const items: FeedItem[] = withoutEngineCopies(((selected.data ?? []) as unknown as Row[])
    .filter((r) => r.offer && !r.offer.archived_at)
    .map((r) => ({
      ...r,
      offer: r.offer!,
      saved: actionByOffer.get(r.offer!.id)?.saved ?? false,
      dismissed: actionByOffer.get(r.offer!.id)?.dismissed ?? false,
    })));

  return {
    items,
    openness: criteria.openness,
    pending: Math.max(0, (activeCount.count ?? 0) - (scoredCount.count ?? 0)),
    excludedCount: excludedCount.count ?? 0,
    favoriteCompanyIds: (favorites.data ?? []).map((f) => f.company_id as string),
    criteriaVersion: version,
    total: activeCount.count ?? 0,
    hasOffers: (activeCount.count ?? 0) > 0,
  };
}
