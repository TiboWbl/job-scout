import { AppShell } from "@/components/app-shell";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Public page (Google's brand verification reads it signed out); inside the app when signed in.
export default async function PrivacyLayout({ children }: { children: React.ReactNode }) {
  const standalone = <main className="mx-auto max-w-2xl px-5 py-12 md:py-16">{children}</main>;
  const { supabase, user } = await getUser();
  if (!user) return standalone;
  const { data: profile } = await supabase.from("profiles").select("display_name, onboarded_at").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded_at) return standalone;
  return (
    <AppShell user={user} firstName={profile.display_name || null}>
      {children}
    </AppShell>
  );
}
