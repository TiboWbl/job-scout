import Link from "next/link";
import { EmailLogin } from "@/components/email-login";
import { LoginButton } from "@/components/login-button";
import { openSignupLimit } from "@/lib/access";

const FEATURES = [
  { title: "Les offres faites pour toi", text: "Lues chaque jour sur les pages carrière de centaines d'entreprises, triées selon ton profil, avec la raison.", tone: "bg-violet-soft text-violet-ink" },
  { title: "Ce que ton métier demande", text: "Les compétences qui comptent vraiment, l'expérience réellement exigée, face à ton CV.", tone: "bg-mint-soft text-mint-ink" },
  { title: "Tes candidatures, prêtes et suivies", text: "Un message prêt à envoyer, les questions d'entretien probables, et tout ton suivi au même endroit.", tone: "bg-peach-soft text-peach-ink" },
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

        <ul className="grid gap-3" aria-label="Ce que fait Scout">
          {FEATURES.map((f, i) => (
            <li key={f.title} className={`animate-rise rounded-[22px] p-5 ${f.tone}`} style={{ animationDelay: `${i * 80}ms` }}>
              <h2 className="font-display text-lg font-bold">{f.title}</h2>
              <p className="mt-1 text-[14.5px] leading-relaxed opacity-85">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
