import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { withoutEngineCopies } from "@/lib/domain/feed";
import { getUser } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/views/feed";

export const metadata = { title: "Entreprises" };

type Company = { id: string; name: string; domain: string | null; brand: string | null; product: string | null; ats: string | null };

// Who recruits for you: your favourites first, with their offers for you, then the other companies
// that have offers in your selection. A button opens their offers in Offres.
export default async function EntreprisesPage() {
  const { supabase, user } = await getUser();
  const [feed, favs] = await Promise.all([
    loadFeed(supabase, user!.id),
    supabase.from("favorite_companies").select("company:companies(id, name, domain, brand, product, ats)").eq("user_id", user!.id),
  ]);
  const selection = withoutEngineCopies(feed.items).filter((i) => i.level !== "ecartee" && !i.dismissed);
  const count = new Map<string, { total: number; coeur: number }>();
  const known = new Map<string, Company>();
  for (const i of selection) {
    const c = count.get(i.offer.company.id) ?? { total: 0, coeur: 0 };
    count.set(i.offer.company.id, { total: c.total + 1, coeur: c.coeur + (i.level === "coeur" ? 1 : 0) });
    known.set(i.offer.company.id, { ...i.offer.company, ats: "known" });
  }
  const favorites = ((favs.data ?? []) as unknown as { company: Company | null }[])
    .map((f) => f.company)
    .filter((c): c is Company => Boolean(c))
    .sort((a, b) => (count.get(b.id)?.total ?? 0) - (count.get(a.id)?.total ?? 0) || a.name.localeCompare(b.name));
  const favIds = new Set(favorites.map((f) => f.id));
  const others = [...known.values()].filter((c) => !favIds.has(c.id)).sort((a, b) => (count.get(b.id)?.total ?? 0) - (count.get(a.id)?.total ?? 0)).slice(0, 40);

  const row = (c: Company, favorite: boolean) => {
    const n = count.get(c.id);
    return (
      <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <CompanyLogo name={c.name} domain={c.domain} brand={c.brand} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{c.name}</span>
            {favorite && <span className="text-[15px] leading-none text-[#f5a524]" aria-label="Entreprise favorite">★</span>}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {n ? `${n.total} offre${n.total > 1 ? "s" : ""} pour toi${n.coeur ? `, dont ${n.coeur} coup${n.coeur > 1 ? "s" : ""} de cœur` : ""}` : favorite && !c.ats ? "Page carrière introuvable, cherchée sur les moteurs" : "Aucune offre pour toi en ce moment"}
            {c.product ? ` · ${c.product}` : ""}
          </span>
        </span>
        <Link href={`/offres?q=${encodeURIComponent(c.name)}`} className="btn-soft shrink-0">
          Voir les offres
        </Link>
      </li>
    );
  };

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Entreprises</h1>
        <Link href="/recherche" className="btn-soft">
          Gérer mes favorites
        </Link>
      </div>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">Mes favorites · {favorites.length}</h2>
        {favorites.length ? <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{favorites.map((c) => row(c, true))}</ul> : <p className="mt-3 text-muted">Ajoute tes entreprises de rêve dans Ma recherche : Scout surveille leur page carrière.</p>}
      </section>
      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Elles recrutent pour toi</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{others.map((c) => row(c, false))}</ul>
        </section>
      )}
    </div>
  );
}
