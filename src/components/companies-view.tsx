import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { Favorites } from "@/components/favorites";
import { RemoveFavorite } from "@/components/remove-favorite";
import { withoutEngineCopies } from "@/lib/domain/feed";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFeed } from "@/lib/views/feed";

type Company = { id: string; name: string; domain: string | null; brand: string | null; product: string | null; ats: string | null };

// Who recruits for you: your favourites first, with their offers for you, then the other companies
// that have offers in your selection. A button opens their offers in Offres.
// Shared by the app and the demo (`base` prefixes links; the demo cannot add or remove favourites).
export async function CompaniesView({ db, userId, base = "", demo = false }: { db: SupabaseClient; userId: string; base?: string; demo?: boolean }) {
  const [feed, favs] = await Promise.all([
    loadFeed(db, userId),
    db.from("favorite_companies").select("company:companies(id, name, domain, brand, product, ats)").eq("user_id", userId),
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
  const withOffers = favorites.filter((c) => count.has(c.id));
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
            {n ? `${n.total} offre${n.total > 1 ? "s" : ""} pour toi${n.coeur ? `, dont ${n.coeur} coup${n.coeur > 1 ? "s" : ""} de cœur` : ""}` : c.ats ? "Page carrière lue à chaque collecte" : "Page carrière introuvable : cherchée sur les moteurs d'emploi"}
            {c.product ? ` · ${c.product}` : ""}
          </span>
        </span>
        {n && (
          <Link href={`${base}/offres?q=${encodeURIComponent(c.name)}`} className="btn-soft shrink-0">
            Voir les offres
          </Link>
        )}
        {favorite && !demo && <RemoveFavorite companyId={c.id} name={c.name} />}
      </li>
    );
  };
  const quiet = favorites.filter((c) => !count.has(c.id));

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-4xl font-extrabold md:text-5xl tracking-tight">Entreprises</h1>
      <div className="mt-8">
        {demo ? (
          <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
            <h2 className="font-display text-xl font-bold">Tes entreprises de rêve</h2>
            <p className="mt-1 text-sm text-muted">Avec un compte, tu ajoutes les entreprises que tu vises (ou une liste entière) : Scout trouve leur page carrière et la lit à chaque collecte. Voici celles de Camille.</p>
          </section>
        ) : (
          <Favorites list={false} />
        )}
      </div>
      {withOffers.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Tes favorites qui recrutent pour toi · {withOffers.length}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{withOffers.map((c) => row(c, true))}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Elles recrutent aussi pour toi</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{others.map((c) => row(c, false))}</ul>
        </section>
      )}
      {quiet.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Tes favorites sans offre pour toi en ce moment · {quiet.length}</h2>
          <p className="mt-1 text-sm text-muted">Scout continue de les surveiller : leurs offres apparaîtront dès qu&apos;elles correspondront à ta recherche.</p>
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{quiet.map((c) => row(c, true))}</ul>
        </section>
      )}
      {favorites.length === 0 && <p className="mt-6 text-muted">Ajoute tes entreprises de rêve ci-dessus : Scout surveille leur page carrière à chaque collecte.</p>}
    </div>
  );
}
