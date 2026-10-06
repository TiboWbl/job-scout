import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isInvited } from "@/lib/access";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (!(await isInvited(user.email))) redirect("/invitation");
  const { data: profile } = await supabase.from("profiles").select("display_name, onboarded_at").eq("id", user.id).single();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <AppShell user={user} firstName={profile.display_name || null}>
      {children}
    </AppShell>
  );
}
