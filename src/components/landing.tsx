import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { LevelBadge } from "@/components/level-badge";
import { LoginButton } from "@/components/login-button";
import { getDemoUserId } from "@/lib/demo";
import { tintStyle } from "@/lib/design/color";
import type { Level } from "@/lib/domain/offer";
import { createAdminClient } from "@/lib/supabase/admin";

type Preview = { level: Level; why: string | null; offer: { title: string; company: { name: string; domain: string | null; brand: string | null; accent_color: string | null } } | null };

// Public home: what Scout does in one line, shown with real offers sorted for the demo persona.
export async function Landing({ notice = null }: { notice?: "error" | "deleted" | null }) {
  const db = createAdminClient();
  const demoId = await getDemoUserId(db);
  const [previews, offers, boards] = await Promise.all([
    demoId
      ? db
          .from("offer_scores")
          .select("level, why, offer:offers(title, company:companies(name, domain, brand, accent_color))")
          .eq("user_id", demoId)
          .in("level", ["coeur", "solide"])
          .order("level", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
    db.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null),
    db.from("companies").select("id", { count: "exact", head: true }).not("ats", "is", null),
  ]);
  const cards = ((previews.data ?? []) as unknown as Preview[]).filter((p) => p.offer);
  const n = (v: number | null) => (v ?? 0).toLocaleString("fr-FR");

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:px-8">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl font-extrabold tracking-tight">
          Scout<span className="text-brand">.</span>
        </p>
      </header>

      <section className="mt-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-rise">
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Toute ta recherche d&apos;emploi dans un seul onglet.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Scout lit les offres de centaines d&apos;entreprises, garde celles qui te correspondent vraiment, te dit pourquoi, puis suit tes candidatures.
          </p>
          <div className="mt-8 flex max-w-md flex-col gap-3">
            <Link href="/demo" className="flex items-center justify-center rounded-2xl bg-brand px-5 py-4 text-[15px] font-semibold text-white hover:opacity-90">
              Voir la démo
            </Link>
            <LoginButton />
            {notice === "error" && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">La connexion n&apos;a pas abouti. Tu peux réessayer.</p>}
            {notice === "deleted" && <p className="rounded-xl bg-pill-solid px-4 py-3 text-sm">Ton compte et toutes tes données ont été supprimés.</p>}
            <div className="flex items-center justify-center gap-3 text-sm text-muted">
              Connexion sur invitation
              <Link href="/confidentialite" className="btn-soft py-1.5">
                Confidentialité
              </Link>
            </div>
          </div>
        </div>

        <ul className="space-y-3" aria-label="Des offres triées pour un profil fictif">
          {cards.map((c, i) => (
            <li
              key={i}
              style={tintStyle(c.offer!.company.accent_color)}
              className="tinted animate-rise rounded-[22px] border border-[var(--halo)] p-4 shadow-[0_12px_40px_-24px_rgba(23,21,31,0.35)]"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo name={c.offer!.company.name} domain={c.offer!.company.domain} brand={c.offer!.company.brand} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[17px] font-bold leading-tight">{c.offer!.title}</span>
                  <span className="block truncate text-sm text-muted">{c.offer!.company.name}</span>
                </span>
                <LevelBadge level={c.level} />
              </div>
              {c.why && (
                <p className="mt-3 rounded-xl bg-surface/80 px-3 py-2 text-[13.5px] leading-snug">
                  <span className="font-semibold text-[var(--accent)]">Pour toi : </span>
                  {c.why}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <p className="rounded-[22px] bg-violet-soft p-5 text-violet-ink">
          <span className="block font-display text-3xl font-extrabold">{n(offers.count)}</span>
          offres lues en ce moment
        </p>
        <p className="rounded-[22px] bg-mint-soft p-5 text-mint-ink">
          <span className="block font-display text-3xl font-extrabold">{n(boards.count)}</span>
          pages carrière surveillées
        </p>
        <p className="rounded-[22px] bg-peach-soft p-5 text-peach-ink">
          <span className="block font-display text-3xl font-extrabold">Chaque offre</span>
          expliquée : pourquoi elle est là, ou pourquoi elle est écartée
        </p>
      </section>

    </main>
  );
}
