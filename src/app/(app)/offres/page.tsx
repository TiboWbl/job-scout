import { Criteria } from "@/lib/domain/criteria";
import type { FeedItem } from "@/lib/domain/feed";
import { isAdminEmail } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { Feed } from "./feed";

const OFFER_FIELDS =
  "id, title, location_raw, places, remote, contract, experience_min_years, apply_url, published_at, first_seen_at, archived_at, company:companies(name, domain, accent_color)";

export default async function OffresPage() {
  const { supabase, user } = await getUser();
  const userId = user!.id;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version").eq("id", userId).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const version = profile?.criteria_version ?? 0;

  const scoreQuery = () =>
    supabase
      .from("offer_scores")
      .select(`level, out_of_zone, excluded_reason, score_interet, score_chances, score_tremplin, why, strengths, watch, cv_levers, scored_by, offer:offers(${OFFER_FIELDS})`)
      .eq("user_id", userId)
      .eq("criteria_version", version);

  // Kept apart so the (usually many) set-aside offers never crowd out the selection.
  const [selected, setAside, actions, activeCount, scoredCount] = await Promise.all([
    scoreQuery().neq("level", "ecartee").limit(1500),
    scoreQuery().eq("level", "ecartee").order("created_at", { ascending: false }).limit(300),
    supabase.from("user_offers").select("offer_id, saved, dismissed"),
    supabase.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version),
  ]);

  const actionByOffer = new Map((actions.data ?? []).map((a) => [a.offer_id, a]));
  type Row = Omit<FeedItem, "offer" | "saved" | "dismissed"> & { offer: (FeedItem["offer"] & { archived_at: string | null }) | null };
  const items: FeedItem[] = ([...(selected.data ?? []), ...(setAside.data ?? [])] as unknown as Row[])
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
      hasOffers={(activeCount.count ?? 0) > 0}
      isAdmin={isAdminEmail(user!.email)}
    />
  );
}
