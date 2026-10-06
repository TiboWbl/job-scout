import { redirect } from "next/navigation";
import { Rail } from "@/components/rail";
import { isInvited } from "@/lib/access";
import { isAdminEmail } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (!(await isInvited(user.email))) redirect("/invitation");
  const { data: profile } = await supabase.from("profiles").select("display_name, onboarded_at").eq("id", user.id).single();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const items = [
    { href: "/aujourdhui", label: "Aujourd'hui" },
    { href: "/offres", label: "Offres" },
    { href: "/suivi", label: "Suivi" },
    { href: "/recherche", label: "Ma recherche" },
  ];
  const meta = user.user_metadata;
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 md:flex-row">
      <Rail items={items} firstName={profile.display_name || null} avatarUrl={avatarUrl} isAdmin={isAdminEmail(user.email)} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
