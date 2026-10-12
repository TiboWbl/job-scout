import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompaniesBlock, ExperienceBlock, RemoteBlock, SalaryBlock } from "@/components/market/blocks";
import { MarketSkills } from "@/components/market/skills";
import type { MarketData } from "@/lib/market/compute";
import { createAdminClient } from "@/lib/supabase/admin";

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

async function card(id: string): Promise<MarketData | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await createAdminClient().from("market_cards").select("data").eq("id", id).maybeSingle();
  return (data?.data as MarketData | undefined) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await card((await params).id);
  return m ? { title: `Le marché ${m.role}`, description: `Ce que demandent vraiment ${m.total} offres de ${m.role}, lues par Scout.` } : { title: "Carte introuvable" };
}

// A market card shared by someone: public, without an account, nothing personal on it.
export default async function MarketCardPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await card((await params).id);
  if (!m) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
          Scout<span className="text-brand">.</span>
        </Link>
        <Link href="/demo/marche" className="btn-soft">
          Voir Scout en démo
        </Link>
      </div>
      <p className="mt-10 text-[15px] font-semibold text-brand">Carte du marché · {day(m.day)}</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Ce que demandent vraiment les offres de {m.role}</h1>
      <p className="mt-3 max-w-2xl text-[16px] text-muted">
        {m.total.toLocaleString("fr-FR")} offres en ligne, lues en entier par Scout sur les pages carrière des entreprises et les moteurs d&apos;emploi. Chaque chiffre est compté dans les textes, jamais estimé.
      </p>

      <section className="mt-8 rounded-[22px] border border-line bg-surface p-5 md:p-7">
        <h2 className="font-display text-2xl font-bold">Les compétences citées</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Part des offres qui citent chaque compétence. « Souvent un plus » : rangée parmi les bonus dans au moins 4 offres sur 10.</p>
        <MarketSkills skills={m.skills} trend={{}} mine={0} personal={false} since={null} />
      </section>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ExperienceBlock m={m} />
        <SalaryBlock m={m} />
        <RemoteBlock m={m} />
      </div>
      <div className="mt-10">
        <CompaniesBlock m={m} linked={false} />
      </div>

      <section className="mt-14 rounded-[26px] bg-violet-soft p-7 text-center md:p-10">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-violet-ink">Et ton marché à toi ?</h2>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-violet-ink/80">
          Scout lit chaque jour les offres de ton métier, les trie pour toi, et te dit ce qu&apos;elles demandent vraiment, face à ton CV.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-button px-5 py-3 text-sm font-semibold text-button-ink">
            Découvrir Scout
          </Link>
          <Link href="/demo" className="btn-soft">
            Essayer la démo
          </Link>
        </div>
      </section>
    </main>
  );
}
