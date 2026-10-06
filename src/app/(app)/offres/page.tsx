import { isAdminEmail } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/views/feed";
import { Feed } from "./feed";

// ?offre=<id> opens that offer directly (links from Aujourd'hui).
export default async function OffresPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const data = await loadFeed(supabase, user!.id);
  return <Feed {...data} initialOpenId={offre ?? null} isAdmin={isAdminEmail(user!.email)} />;
}
