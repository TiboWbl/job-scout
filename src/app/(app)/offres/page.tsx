import { Criteria } from "@/lib/domain/criteria";
import { SCORE_SELECT, type FeedItem } from "@/lib/domain/feed";
import { isAdminEmail } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { Feed } from "./feed";

export default async function OffresPage() {
  const { supabase, user } = await getUser();
  const userId = user!.id;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version").eq("id", userId).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const version = profile?.criteria_version ?? 0;

  // Set-aside offers are only counted here; the "Écartées" view loads them on demand.
  const [selected, excludedCount, actions, activeCount, scoredCount] = await Promise.all([
    supabase.from("offer_scores").select(SCORE_SELECT).eq("user_id", userId).eq("criteria_version", version).neq("level", "ecartee").limit(1500),
    supabase.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version).eq("level", "ecartee"),
    supabase.from("user_offers").select("offer_id, saved, dismissed"),
    supabase.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version),
  ]);

  const actionByOffer = new Map((actions.data ?? []).map((a) => [a.offer_id, a]));
  type Row = Omit<FeedItem, "offer" | "saved" | "dismissed"> & { offer: (FeedItem["offer"] & { archived_at: string | null }) | null };
  const items: FeedItem[] = ((selected.data ?? []) as unknown as Row[])
    .filter((r) => r.offer && !r.offer.archived_at)
    .map((r) => ({
      ...r,
      offer: r.offer!,
      saved: actionByOffer.get(r.offer!.id)?.saved ?? false,
      dismissed: actionByOffer.get(r.offer!.id)?.dismissed ?? false,
    }));

  const pending = Math.max(0, (activeCount.count ?? 0) - (scoredCount.count ?? 0));

  return (
    <Feed
      items={items}
      openness={criteria.openness}
      pending={pending}
      excludedCount={excludedCount.count ?? 0}
      criteriaVersion={version}
      total={activeCount.count ?? 0}
      hasOffers={(activeCount.count ?? 0) > 0}
      isAdmin={isAdminEmail(user!.email)}
    />
  );
}
