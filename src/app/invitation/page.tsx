import { redirect } from "next/navigation";
import { isInvited } from "@/lib/access";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Invitation" };

export const dynamic = "force-dynamic";

export default async function InvitationPage() {
  const { user } = await getUser();
  if (!user) redirect("/");
  if (await isInvited(user.email, user.id)) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md animate-rise">
        <p className="font-display text-4xl font-extrabold tracking-tight">
          Scout<span className="text-brand">.</span>
        </p>
        <h1 className="mt-8 font-display text-3xl font-extrabold leading-tight tracking-tight">Scout est complet pour l&apos;instant</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Scout fonctionne avec des services gratuits, partagés par tous : le nombre de comptes est limité. Ton adresse ({user.email}) n&apos;est pas encore sur la liste. Demande à la personne qui t&apos;a parlé de Scout de t&apos;inviter, puis reconnecte-toi.
        </p>
        <form action="/auth/signout" method="post" className="mt-8">
          <button type="submit" className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-pill">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
