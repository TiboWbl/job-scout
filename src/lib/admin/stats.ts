import type { SupabaseClient } from "@supabase/supabase-js";

// Admin dashboard figures: aggregates only, nothing that identifies a user or their search.

const DAY = 86_400_000;
export const CHART_DAYS = 14;

const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  jooble: "Jooble",
  manual: "Ajoutées par URL",
  "france-travail": "France Travail",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
  teamtailor: "Teamtailor",
  personio: "Personio",
};
const ORIGIN_LABELS: Record<string, string> = { seed: "Stock de départ", crawl: "Index public (Common Crawl)", name: "Nom vu dans une offre", user: "Ajoutée par un utilisateur" };
const LEVEL_LABELS: Record<string, string> = { coeur: "Coups de cœur", solide: "Solides", tremplin: "Tremplins", ecartee: "Écartées" };

export type Bar = { label: string; value: number };

type Row = Record<string, string | number>;
const bars = (rows: Row[] | null, key: string, labels: Record<string, string>): Bar[] =>
  (rows ?? []).map((r) => ({ label: labels[String(r[key])] ?? String(r[key]), value: Number(r.n) }));

// Grouping happens in Postgres (supabase/migrations/0009_admin_stats.sql): the page stays fast as data grows.
export async function dashboardStats(db: SupabaseClient, now = Date.now()) {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [sources, perDayRows, origins, levels, activeOffers, directory, onboarded, applications, added, favorites] = await Promise.all([
    db.rpc("admin_offer_sources"),
    db.rpc("admin_offers_per_day", { days: CHART_DAYS }),
    db.rpc("admin_directory_origins"),
    db.rpc("admin_ai_levels"),
    count(db.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null)),
    count(db.from("companies").select("id", { count: "exact", head: true }).not("ats", "is", null)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).not("onboarded_at", "is", null)),
    count(db.from("applications").select("id", { count: "exact", head: true })),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("origin", "added")),
    count(db.from("favorite_companies").select("company_id", { count: "exact", head: true })),
  ]);

  const byDay = new Map(((perDayRows.data ?? []) as Row[]).map((r) => [String(r.day), Number(r.n)]));
  const perDay: Bar[] = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(now - (CHART_DAYS - 1 - i) * DAY);
    const key = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    return { label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: byDay.get(key) ?? 0 };
  });
  const levelBars = bars(levels.data as Row[], "level", LEVEL_LABELS);

  return {
    activeOffers,
    directory,
    judgedByAi: levelBars.reduce((n, b) => n + b.value, 0),
    onboarded,
    applications,
    added,
    favorites,
    perDay,
    sources: bars(sources.data as Row[], "source", SOURCE_LABELS),
    origins: bars(origins.data as Row[], "origin", ORIGIN_LABELS),
    levels: levelBars,
  };
}

export type Invitee = { email: string; via: "admin" | "env" | "admin page"; lastSignIn: string | null };

// Invited addresses and whether each person has signed in yet (from the auth server, admin only).
export async function invitees(db: SupabaseClient, adminEmail: string | undefined, fromEnv: string[], invited: string[]): Promise<Invitee[]> {
  const signIns = new Map<string, string | null>();
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email) signIns.set(u.email.toLowerCase(), u.last_sign_in_at ?? null);
    if (!data || data.users.length < 200) break;
  }
  const rows: Invitee[] = [];
  const add = (email: string, via: Invitee["via"]) => {
    const e = email.toLowerCase();
    if (!rows.some((r) => r.email === e)) rows.push({ email: e, via, lastSignIn: signIns.get(e) ?? null });
  };
  if (adminEmail) add(adminEmail, "admin");
  fromEnv.forEach((e) => add(e, "env"));
  invited.forEach((e) => add(e, "admin page"));
  return rows;
}
