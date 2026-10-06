import { getUser } from "@/lib/supabase/server";
import { TodayView } from "@/components/today-view";

export default async function TodayPage() {
  const { supabase, user } = await getUser();
  return <TodayView db={supabase} userId={user!.id} />;
}
