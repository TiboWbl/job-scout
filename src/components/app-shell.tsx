import { Rail } from "@/components/rail";
import { isAdminEmail } from "@/lib/env";
import type { SessionUser } from "@/lib/supabase/server";

const ITEMS = [
  { href: "/aujourdhui", label: "Aujourd'hui" },
  { href: "/offres", label: "Offres" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/suivi", label: "Suivi" },
  { href: "/cv", label: "Mon CV" },
  { href: "/recherche", label: "Ma recherche" },
];

// Sidebar + content, shared by the app and by public pages viewed while signed in.
export function AppShell({ user, firstName, children }: { user: SessionUser; firstName: string | null; children: React.ReactNode }) {
  const meta = user.user_metadata;
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 md:flex-row">
      <Rail items={ITEMS} firstName={firstName} avatarUrl={avatarUrl} isAdmin={isAdminEmail(user.email)} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
