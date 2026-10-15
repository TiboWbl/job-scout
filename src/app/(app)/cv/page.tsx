import { getUser } from "@/lib/supabase/server";
import { loadCvPage } from "@/lib/views/cv";
import { CvCheck } from "./cv-check";

export const metadata = { title: "Mon CV" };

export default async function CvPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { supabase, user } = await getUser();
  const { history, offers, marketKeywords } = await loadCvPage(supabase, user!.id);
  return <CvCheck history={history} offers={offers} marketKeywords={marketKeywords} initialOfferId={offre ?? null} />;
}
