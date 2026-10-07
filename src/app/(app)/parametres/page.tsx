import { DigestToggle } from "@/components/digest-toggle";
import { getUser } from "@/lib/supabase/server";
import Link from "next/link";
import { DeleteAccount } from "@/components/delete-account";
import { ThemePicker } from "@/components/theme-picker";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("email_digest").eq("id", user!.id).single();
  return (
    <div className="max-w-3xl px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Paramètres</h1>

      <section className="mt-8 rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Apparence</h2>
        <p className="mt-1 text-sm text-muted">Automatique suit le réglage de ton appareil.</p>
        <div className="mt-4">
          <ThemePicker />
        </div>
      </section>

      <section className="mt-6 rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Email des coups de cœur</h2>
        <p className="mt-1 text-sm text-muted">Reçois tes nouveaux coups de cœur le matin, sans ouvrir Scout.</p>
        <div className="mt-4">
          <DigestToggle initial={Boolean(profile?.email_digest)} email={user!.email ?? null} />
        </div>
      </section>

      <section className="mt-6 rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Tes données</h2>
        <p className="mt-1 text-sm text-muted">Ce que Scout garde, pourquoi, et ce que voit l&apos;IA.</p>
        <Link href="/confidentialite" className="btn-soft mt-4">
          Confidentialité
        </Link>
      </section>

      <div className="mt-6">
        <DeleteAccount />
      </div>
    </div>
  );
}
