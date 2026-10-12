import { MarketView } from "@/components/market/market-view";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Mon marché" };
export const maxDuration = 60;

export default async function MarketPage() {
  const { supabase, user } = await getUser();
  return <MarketView db={supabase} userId={user!.id} />;
}
