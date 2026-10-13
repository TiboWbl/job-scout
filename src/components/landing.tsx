import Link from "next/link";
import { EmailLogin } from "@/components/email-login";
import { LoginButton } from "@/components/login-button";
import { openSignupLimit } from "@/lib/access";
import { CompanyLogo } from "@/components/company-logo";
import { tintStyle } from "@/lib/design/color";
import { CONTRACT_LABELS } from "@/lib/domain/criteria";
import type { Place } from "@/lib/domain/offer";
import { freshness, placeLabel } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Real offers read by Scout today, in three different jobs: proof that it reads real companies, for
// every job. Only offers read in full from the company's own career page, with a real logo.
const JOBS: [string, RegExp][] = [
  ["communication", /\b(charg[ée]e? de communication|communication|marketing)\b/i],
  ["data", /\b(data (analyst|scientist|engineer)|analyste)\b/i],
  ["design", /\b(ux|ui|product|graphic)? ?designer\b/i],
  ["commercial", /\b(business developer|account executive|commercial)\b/i],
];
type Real = { id: string; title: string; places: Place[]; location_raw: string | null; contract: string; salary_text: string | null; published_at: string | null; first_seen_at: string; company: { name: string; domain: string | null; brand: string | null; accent_color: string | null } };

async function realOffers(): Promise<Real[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const { data } = await db
    .from("offers")
    .select("id, title, places, location_raw, contract, salary_text, published_at, first_seen_at, sources, company:companies!inner(name, domain, brand, accent_color)")
    .is("archived_at", null)
    .not("company.domain", "is", null)
    .not("company.accent_color", "is", null)
    .gte("first_seen_at", since)
    .order("first_seen_at", { ascending: false })
    .limit(600);
  // Recent for real: an evergreen posting re-listed every day is not "new".
  const fresh = (o: Real) => Date.parse(o.published_at ?? o.first_seen_at) > Date.now() - 14 * 86_400_000;
  const rows = ((data ?? []) as unknown as (Real & { sources: string[] })[]).filter((o) => o.sources.some((s) => !["adzuna", "jooble"].includes(s)) && o.title.length < 60 && fresh(o));
  const picked: Real[] = [];
  for (const [, re] of JOBS) {
    const o = rows.find((r) => re.test(r.title) && !picked.some((p) => p.company.name === r.company.name));
    if (o) picked.push(o);
    if (picked.length === 3) break;
  }
  return picked;
}

// Public home: what Scout does, for any job, and the ways in, all on one screen.
export async function Landing({ notice = null }: { notice?: "error" | "deleted" | null }) {
  const offers = await realOffers().catch(() => []);
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

        {offers.length > 0 && (
          <div>
            <p className="mb-3 text-center text-[13px] text-muted">Des offres lues par Scout ces derniers jours, dans trois métiers</p>
            <ul className="space-y-3" aria-label="Des offres réelles lues par Scout">
              {offers.map((o, i) => (
                <li key={o.id} style={{ ...tintStyle(o.company.accent_color), animationDelay: `${i * 90}ms` }} className="tinted animate-rise rounded-[22px] border border-[var(--halo)] p-4 shadow-[0_12px_40px_-24px_rgba(23,21,31,0.35)]">
                  <div className="flex items-center gap-3">
                    <CompanyLogo name={o.company.name} domain={o.company.domain} brand={o.company.brand} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[17px] font-bold leading-tight">{o.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {o.company.name} · publiée {freshness(o.published_at ?? o.first_seen_at)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-medium text-muted">
                    <span className="rounded-full bg-surface/80 px-2.5 py-1">{placeLabel(o.places, o.location_raw)}</span>
                    {o.contract !== "unknown" && <span className="rounded-full bg-surface/80 px-2.5 py-1">{CONTRACT_LABELS[o.contract as keyof typeof CONTRACT_LABELS]}</span>}
                    {o.salary_text && <span className="rounded-full bg-surface/80 px-2.5 py-1 text-ink">{o.salary_text}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
