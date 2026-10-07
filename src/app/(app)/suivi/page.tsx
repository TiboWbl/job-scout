import { getUser } from "@/lib/supabase/server";
import { loadBoard } from "@/lib/views/board";
import { Board } from "./board";

export const metadata = { title: "Suivi" };

// ?ajouter=1 opens the "add an offer" form; ?ajouter=<url> fills it (from the ⌘K search).
export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ ajouter?: string }> }) {
  const { ajouter } = await searchParams;
  const { supabase, user } = await getUser();
  return <Board items={await loadBoard(supabase, user!.id)} addUrl={ajouter ? (/^https?:\/\//.test(ajouter) ? ajouter : "") : null} />;
}
