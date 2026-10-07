import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/views/feed";
import { Feed } from "./feed";

export const metadata = { title: "Offres" };

// ?offre=<id> opens that offer directly (links from Aujourd'hui); ?q= starts with a search (Entreprises).
export default async function OffresPage({ searchParams }: { searchParams: Promise<{ offre?: string; q?: string }> }) {
  const { offre, q } = await searchParams;
  const { supabase, user } = await getUser();
  const [data, { data: profile }, { data: lastRun }] = await Promise.all([
    loadFeed(supabase, user!.id),
    supabase.from("profiles").select("collect_requested_at").eq("id", user!.id).single(),
    // Only the time of the latest collection (shared, no personal data).
    createAdminClient().from("collection_runs").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // A collection asked for after a change of search, not run yet (it takes about ten minutes).
  const requested = profile?.collect_requested_at ? new Date(profile.collect_requested_at).getTime() : 0;
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const collecting = requested > now - 45 * 60_000 && (!lastRun || new Date(lastRun.started_at).getTime() < requested);
  return <Feed {...data} collecting={collecting} initialOpenId={offre ?? null} initialQuery={q?.slice(0, 80) ?? ""} isAdmin={isAdminEmail(user!.email)} />;
}
