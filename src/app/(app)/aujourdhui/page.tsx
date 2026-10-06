import Link from "next/link";
import { followUpDue, isUpcoming, type Application } from "@/lib/domain/application";
import { Criteria } from "@/lib/domain/criteria";
import { LEVEL_ORDER, SCORE_SELECT, type FeedItem } from "@/lib/domain/feed";
import { tintStyle } from "@/lib/design/color";
import { isStale } from "@/lib/format";
import { rank } from "@/lib/scoring/judge";
import { getUser } from "@/lib/supabase/server";
import { CompanyLogo } from "@/components/company-logo";
import { LevelBadge } from "@/components/level-badge";

const SELECTION_SIZE = 6;
const NEW_HOURS = 72;
const DAY = 86_400_000;

// Monday 00:00, local to the server: "this week" for the progress line.
function weekStart(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// In 30 seconds: what to look at today, who to follow up with, what is coming, how the week goes.
export default async function TodayPage() {
  const { supabase, user } = await getUser();
  const userId = user!.id;
  const { data: profile } = await supabase.from("profiles").select("display_name, criteria, criteria_version").eq("id", userId).single();
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const version = profile?.criteria_version ?? 0;

  const [scores, actions, applications, activeCount, scoredCount] = await Promise.all([
    supabase.from("offer_scores").select(SCORE_SELECT).eq("user_id", userId).eq("criteria_version", version).neq("level", "ecartee").limit(1500),
    supabase.from("user_offers").select("offer_id, dismissed"),
    supabase.from("applications").select("id, offer_id, title, company, url, stage, applied_at, interview_at, followed_up_at, created_at"),
    supabase.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("offer_scores").select("offer_id", { count: "exact", head: true }).eq("user_id", userId).eq("criteria_version", version),
  ]);

  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const apps = (applications.data ?? []) as Application[];
  const handled = new Set([...(actions.data ?? []).filter((a) => a.dismissed).map((a) => a.offer_id), ...apps.map((a) => a.offer_id)]);
  type Row = Omit<FeedItem, "saved" | "dismissed"> & { offer: FeedItem["offer"] & { archived_at: string | null } };
  const candidates = ((scores.data ?? []) as unknown as Row[]).filter(
    (r) => r.offer && !r.offer.archived_at && !r.out_of_zone && !handled.has(r.offer.id) && !isStale(r.offer.published_at ?? r.offer.first_seen_at),
  );
  const isNew = (r: Row) => now - new Date(r.offer.first_seen_at).getTime() < NEW_HOURS * 3_600_000;
  // A finished list: what arrived lately first, then by level and fit. Never an endless scroll.
  const selection = candidates
    .sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || rank(b, criteria.openness) - rank(a, criteria.openness))
    .slice(0, SELECTION_SIZE);

  const followUps = apps.filter((a) => followUpDue(a, now));
  const interviews = apps.filter((a) => isUpcoming(a.interview_at, now)).sort((a, b) => a.interview_at!.localeCompare(b.interview_at!));
  const since = weekStart(new Date(now));
  const sentThisWeek = apps.filter((a) => a.applied_at && new Date(a.applied_at).getTime() >= since).length;
  const interviewsThisWeek = apps.filter((a) => a.interview_at && new Date(a.interview_at).getTime() >= since && new Date(a.interview_at).getTime() < since + 7 * DAY).length;
  const pending = Math.max(0, (activeCount.count ?? 0) - (scoredCount.count ?? 0));
  const firstName = profile?.display_name;

  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <p className="text-[15px] font-medium text-muted first-letter:uppercase">{new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 className="mt-1 font-display text-5xl font-extrabold tracking-tight">{firstName ? `Salut ${firstName} !` : "Salut !"}</h1>
      <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-full bg-violet-soft px-3.5 py-1.5 text-violet-ink">{plural(selection.length, "offre pour toi", "offres pour toi")}</span>
        {interviews.length > 0 && <span className="rounded-full bg-mint-soft px-3.5 py-1.5 text-mint-ink">{plural(interviews.length, "entretien à venir", "entretiens à venir")}</span>}
        {followUps.length > 0 && <span className="rounded-full bg-peach-soft px-3.5 py-1.5 text-peach-ink">{plural(followUps.length, "relance", "relances")}</span>}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">Ta sélection du jour</h2>
            <Link href="/offres" className="btn-soft">
              Toutes mes offres
            </Link>
          </div>
          {pending > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              Encore {pending.toLocaleString("fr-FR")} offres à trier.
              <Link href="/offres" className="btn-soft">
                Lancer le tri
              </Link>
            </p>
          )}
          {selection.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-surface p-6 text-muted">Rien de nouveau pour l&apos;instant. Scout continue de chercher.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {selection.map((r) => (
                <li key={r.offer.id}>
                  <Link
                    href={`/offres?offre=${r.offer.id}`}
                    style={tintStyle(r.offer.company.accent_color)}
                    className="tinted flex items-center gap-4 rounded-[20px] border border-line p-4 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(23,21,31,0.25)]"
                  >
                    <CompanyLogo name={r.offer.company.name} domain={r.offer.company.domain} brand={r.offer.company.brand} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[17px] font-bold leading-tight">{r.offer.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {r.offer.company.name}
                        {r.why ? ` · ${r.why}` : ""}
                      </span>
                    </span>
                    <span className="hidden sm:inline">
                      <LevelBadge level={r.level} prefix={isNew(r) ? "Nouvelle · " : ""} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-4 md:grid-cols-3 xl:grid-cols-1">
          <section className="rounded-[22px] bg-violet-soft p-5">
            <h2 className="font-display text-lg font-bold">Relances à faire</h2>
            {followUps.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Aucune pour l&apos;instant.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {followUps.map((a) => (
                  <li key={a.id}>
                    <Link href="/suivi" className="block rounded-2xl bg-surface px-4 py-3 hover:shadow-sm">
                      <span className="block truncate text-[15px] font-semibold">{a.company}</span>
                      <span className="block truncate text-sm text-muted">
                        Postulé le {new Date(a.applied_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · {a.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-[22px] bg-mint-soft p-5">
            <h2 className="font-display text-lg font-bold">Entretiens à venir</h2>
            {interviews.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Aucun pour l&apos;instant.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {interviews.map((a) => (
                  <li key={a.id}>
                    <Link href="/suivi" className="block rounded-2xl bg-surface px-4 py-3 hover:shadow-sm">
                      <span className="block truncate text-[15px] font-semibold text-mint-ink">{when(a.interview_at!)}</span>
                      <span className="block truncate text-sm text-muted">
                        {a.company} · {a.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-[22px] bg-peach-soft p-5">
            <h2 className="font-display text-lg font-bold">Ta semaine</h2>
            <div className="mt-2 flex gap-6">
              {[
                [sentThisWeek, sentThisWeek > 1 ? "envoyées" : "envoyée"],
                [interviewsThisWeek, interviewsThisWeek > 1 ? "entretiens" : "entretien"],
              ].map(([n, label]) => (
                <p key={label as string}>
                  <span className="block font-display text-3xl font-extrabold text-peach-ink">{n}</span>
                  <span className="text-sm font-medium text-peach-ink">{label}</span>
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
