import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Every new user lands on onboarding; nobody gets a pre-filled feed.
export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).single();
  redirect(profile?.onboarded_at ? "/offres" : "/onboarding");
}
