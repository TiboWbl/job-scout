import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { LevelBadge } from "@/components/level-badge";
import { LoginButton } from "@/components/login-button";
import { EmailLogin } from "@/components/email-login";
import { openSignupLimit } from "@/lib/access";
import type { MarketData } from "@/lib/market/compute";
import { skillLabel } from "@/lib/views/skills";
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
  // The demo persona's market: the proof, before any account, that Scout reads the whole market.
  const { data: snap } = demoId ? await db.from("market_snapshots").select("data").eq("profile_id", demoId).order("day", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const market = (snap?.data as MarketData | undefined) ?? null;
  const topSkills = market ? [...market.skills].filter((s) => s.kind !== "langue").sort((a, b) => b.share - a.share).slice(0, 5) : [];
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
            Scout lit chaque jour les offres de centaines d&apos;entreprises, garde celles qui te correspondent vraiment, te dit pourquoi, et te montre ce que ton métier demande vraiment.
          </p>
          <div className="mt-8 flex max-w-md flex-col gap-3">
            <Link href="/demo" className="flex items-center justify-center rounded-2xl bg-brand px-5 py-4 text-[15px] font-semibold text-white hover:opacity-90">
              Voir la démo
            </Link>
            <LoginButton />
            <EmailLogin />
            {notice === "error" && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">La connexion n&apos;a pas abouti. Tu peux réessayer.</p>}
            {notice === "deleted" && <p className="rounded-xl bg-pill-solid px-4 py-3 text-sm">Ton compte et toutes tes données ont été supprimés.</p>}
            <div className="flex items-center justify-center gap-3 text-sm text-muted">
              {openSignupLimit() > 0 ? "Gratuit, sans carte bancaire" : "Connexion sur invitation"}
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

      {market && topSkills.length > 0 && (
        <Link href="/demo/marche" className="mt-16 block rounded-[26px] border border-line bg-surface p-6 transition-shadow hover:shadow-md md:p-8">
          <p className="text-sm font-semibold text-brand">Ce que Scout lit cette semaine</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            Ce que demandent vraiment {n(market.total)} offres de {market.role}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {topSkills.map((s) => (
              <li key={s.name}>
                <span className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="font-semibold">{skillLabel(s.name)}</span>
                  <span className="tabular-nums text-muted">{s.share} %</span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-pill-solid">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${s.share}%` }} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[14px] text-muted">
            Et pour ton métier : les compétences qui comptent, l&apos;expérience vraiment exigée derrière « junior », les salaires affichés. <span className="font-semibold text-ink">Voir le marché en démo →</span>
          </p>
        </Link>
      )}

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
