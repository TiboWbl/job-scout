import { redirect } from "next/navigation";
import { isInvited } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { Landing } from "@/components/landing";

export const dynamic = "force-dynamic";

// Visitors see the public home (one line, real offers, the demo). Every new user lands on onboarding;
// nobody gets a pre-filled feed.
export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const { supabase, user } = await getUser();
  if (!user) return <Landing />;
  if (!(await isInvited(user.email))) redirect("/invitation");
  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).single();
  redirect(profile?.onboarded_at ? "/aujourdhui" : "/onboarding");
}
