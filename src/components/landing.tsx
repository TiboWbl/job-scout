import Link from "next/link";
import { EmailLogin } from "@/components/email-login";
import { LoginButton } from "@/components/login-button";
import { openSignupLimit } from "@/lib/access";
import { LevelBadge } from "@/components/level-badge";
import { tintStyle } from "@/lib/design/color";
import type { Level } from "@/lib/domain/offer";

// An illustration of what Scout shows, for three different jobs: every job is welcome. These are
// examples (no real company is named), shown in the product's own cards.
const EXAMPLES: { title: string; employer: string; level: Level; why: string; accent: string }[] = [
  { title: "Chargé·e de communication", employer: "Une agence créative", level: "coeur", why: "Communication digitale dans la culture, le secteur que tu vises, profil junior accepté.", accent: "#e8622a" },
  { title: "Data analyst", employer: "Une scale-up santé", level: "solide", why: "SQL et tableaux de bord comme dans ton alternance, à 20 minutes de chez toi.", accent: "#2f9e6e" },
  { title: "Monteur·se vidéo", employer: "Un studio de production", level: "tremplin", why: "Formats courts pour les réseaux : un premier pas vers la réalisation.", accent: "#6d5bf0" },
];

// Public home: what Scout does, for any job, and the ways in, all on one screen.
export function Landing({ notice = null }: { notice?: "error" | "deleted" | null }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-6 md:px-8">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl font-extrabold tracking-tight">
          Scout<span className="text-brand">.</span>
        </p>
        <Link href="/confidentialite" className="text-sm text-muted hover:text-ink">
          Confidentialité
        </Link>
      </header>

      <section className="my-auto grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-rise">
          <h1 className="font-display text-[44px] font-extrabold leading-[1.05] tracking-tight md:text-[56px]">Toute ta recherche d&apos;emploi dans un seul onglet.</h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">Quel que soit ton métier, Scout trouve les offres qui te correspondent et t&apos;aide à décrocher l&apos;entretien.</p>
          <div className="mt-7 flex max-w-sm flex-col gap-2.5">
            <LoginButton />
            <EmailLogin />
            <Link href="/demo" className="flex items-center justify-center rounded-2xl px-5 py-3 text-[15px] font-semibold text-brand hover:bg-brand-soft">
              Voir la démo, sans compte
            </Link>
            {notice === "error" && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">La connexion n&apos;a pas abouti. Tu peux réessayer.</p>}
            {notice === "deleted" && <p className="rounded-xl bg-pill-solid px-4 py-3 text-sm">Ton compte et toutes tes données ont été supprimés.</p>}
            <p className="text-center text-[13px] text-muted">{openSignupLimit() > 0 ? "Gratuit, sans carte bancaire." : "Connexion sur invitation."}</p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-center text-[13px] text-muted">Exemples d&apos;offres triées pour trois personnes</p>
          <ul className="space-y-3" aria-label="Exemples d'offres triées par Scout">
            {EXAMPLES.map((e, i) => (
              <li key={e.title} style={{ ...tintStyle(e.accent), animationDelay: `${i * 90}ms` }} className="tinted animate-rise rounded-[22px] border border-[var(--halo)] p-4 shadow-[0_12px_40px_-24px_rgba(23,21,31,0.35)]">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white font-display text-base font-bold text-[var(--accent)]">
                    {e.employer.split(" ").pop()![0].toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[17px] font-bold leading-tight">{e.title}</span>
                    <span className="block truncate text-sm text-muted">{e.employer}</span>
                  </span>
                  <LevelBadge level={e.level} />
                </div>
                <p className="mt-3 rounded-xl bg-surface/80 px-3 py-2 text-[13.5px] leading-snug">
                  <span className="font-semibold text-[var(--accent)]">Pour toi : </span>
                  {e.why}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
