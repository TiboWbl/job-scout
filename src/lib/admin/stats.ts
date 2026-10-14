import type { SupabaseClient } from "@supabase/supabase-js";

// Admin dashboard figures: aggregates only, nothing that identifies a user or their search.

const DAY = 86_400_000;
export const CHART_DAYS = 14;

const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  jooble: "Jooble",
  manual: "Ajoutées par URL",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
  teamtailor: "Teamtailor",
  personio: "Personio",
  digitalrecruiters: "DigitalRecruiters",
  welcomekit: "Welcome Kit",
  site: "Sites carrière",
  workday: "Workday",
  careerjet: "Careerjet",
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
  // Real people only: the demo persona's tracking and favourites are examples.
  const { data: demo } = await db.from("profiles").select("id").eq("is_demo", true).maybeSingle();
  const notDemo = demo?.id ?? "00000000-0000-0000-0000-000000000000";
  const [dbSize, sources, perDayRows, origins, levels, activeOffers, directory, onboarded, applications, added, favorites] = await Promise.all([
    db.rpc("admin_db_size"),
    db.rpc("admin_offer_sources"),
    db.rpc("admin_offers_per_day", { days: CHART_DAYS }),
    db.rpc("admin_directory_origins"),
    db.rpc("admin_ai_levels"),
    count(db.from("offers").select("id", { count: "exact", head: true }).is("archived_at", null)),
    count(db.from("companies").select("id", { count: "exact", head: true }).not("ats", "is", null)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).not("onboarded_at", "is", null).eq("is_demo", false)),
    count(db.from("applications").select("id", { count: "exact", head: true }).neq("user_id", notDemo)),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("origin", "added").neq("user_id", notDemo)),
    count(db.from("favorite_companies").select("company_id", { count: "exact", head: true }).neq("user_id", notDemo)),
  ]);

  const byDay = new Map(((perDayRows.data ?? []) as Row[]).map((r) => [String(r.day), Number(r.n)]));
  const perDay: Bar[] = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(now - (CHART_DAYS - 1 - i) * DAY);
    const key = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    return { label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: byDay.get(key) ?? 0 };
  });
  const levelBars = bars(levels.data as Row[], "level", LEVEL_LABELS);

  return {
    dbMegabytes: Math.round(Number(dbSize.data ?? 0) / 1_048_576),
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

// Who uses Scout: every real account (how it got in, when it last signed in), then the invitations not
// used yet. The demo persona is not a person.
export type Invitee = { email: string; via: "admin" | "env" | "admin page" | "open"; lastSignIn: string | null; account: boolean };

export async function invitees(db: SupabaseClient, adminEmail: string | undefined, fromEnv: string[], invited: string[]): Promise<Invitee[]> {
  const { data: demo } = await db.from("profiles").select("id").eq("is_demo", true).maybeSingle();
  const accounts: { email: string; lastSignIn: string | null; createdAt: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email && u.id !== demo?.id) accounts.push({ email: u.email.toLowerCase(), lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at });
    if (!data || data.users.length < 200) break;
  }
  const admin = adminEmail?.toLowerCase();
  const via = (e: string): Invitee["via"] => (e === admin ? "admin" : invited.includes(e) ? "admin page" : fromEnv.includes(e) ? "env" : "open");
  const rows: Invitee[] = accounts
    .sort((a, b) => (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? ""))
    .map((a) => ({ email: a.email, via: via(a.email), lastSignIn: a.lastSignIn, account: true }));
  for (const e of [...invited, ...fromEnv]) if (!rows.some((r) => r.email === e)) rows.push({ email: e, via: via(e), lastSignIn: null, account: false });
  return rows;
}
