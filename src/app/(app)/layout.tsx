import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/app-shell";
import { isInvited } from "@/lib/access";
import { followUpDue, isUpcoming, type Application } from "@/lib/domain/application";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/");
  // Both checks at once: every tab waits for them.
  const [invited, { data: profile }, { data: apps }] = await Promise.all([
    isInvited(user.email, user.id),
    supabase.from("profiles").select("display_name, onboarded_at, last_seen_at").eq("id", user.id).single(),
    supabase.from("applications").select("stage, applied_at, interview_at, followed_up_at, created_at").eq("user_id", user.id),
  ]);
  if (!invited) redirect("/invitation");
  if (!profile?.onboarded_at) redirect("/onboarding");
  // Follow-ups due and interviews coming: shown on "Suivi", where they are handled.
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  // The last visit, for the admin's list of users: written at most every 15 minutes, after the page.
  if (!profile.last_seen_at || now - Date.parse(profile.last_seen_at) > 15 * 60_000)
    after(async () => {
      await supabase.from("profiles").update({ last_seen_at: new Date(now).toISOString() }).eq("id", user.id);
    });
  const todo = ((apps ?? []) as Application[]).filter((a) => followUpDue(a, now) || isUpcoming(a.interview_at, now)).length;

  return (
    <AppShell user={user} firstName={profile.display_name || null} todo={todo}>
      {children}
    </AppShell>
  );
}
