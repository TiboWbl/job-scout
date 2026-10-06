import { getUser } from "@/lib/supabase/server";
import { loadBoard } from "@/lib/views/board";
import { Board } from "./board";

export const metadata = { title: "Suivi" };

export default async function SuiviPage() {
  const { supabase, user } = await getUser();
  return <Board items={await loadBoard(supabase, user!.id)} />;
}
