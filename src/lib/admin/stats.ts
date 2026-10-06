import type { SupabaseClient } from "@supabase/supabase-js";

// Admin dashboard figures: aggregates only, nothing that identifies a user or their search.

const DAY = 86_400_000;
export const CHART_DAYS = 14;

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const SOURCE_LABELS: Record<string, string> = { adzuna: "Adzuna", jooble: "Jooble", manual: "Ajoutées par URL", "france-travail": "France Travail" };
const ORIGIN_LABELS: Record<string, string> = { seed: "Stock de départ", crawl: "Index public (Common Crawl)", name: "Nom vu dans une offre", user: "Ajoutée par un utilisateur" };
const LEVEL_LABELS: Record<string, string> = { coeur: "Coups de cœur", solide: "Solides", tremplin: "Tremplins", ecartee: "Écartées" };

export type Bar = { label: string; value: number };

export async function dashboardStats(db: SupabaseClient, now = Date.now()) {
  const since = new Date(now - CHART_DAYS * DAY).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const [offers, recent, boards, scores, kpis] = await Promise.all([
    all<{ sources: string[] }>((f, t) => db.from("offers").select("sources").is("archived_at", null).range(f, t)),
    all<{ first_seen_at: string }>((f, t) => db.from("offers").select("first_seen_at").gte("first_seen_at", since).range(f, t)),
    all<{ discovered_via: string | null }>((f, t) => db.from("companies").select("discovered_via").not("ats", "is", null).range(f, t)),
    all<{ level: string; scored_by: string }>((f, t) => db.from("offer_scores").select("level, scored_by").range(f, t)),
    Promise.all([
      count(db.from("profiles").select("id", { count: "exact", head: true }).not("onboarded_at", "is", null)),
      count(db.from("applications").select("id", { count: "exact", head: true })),
      count(db.from("applications").select("id", { count: "exact", head: true }).eq("origin", "added")),
      count(db.from("favorite_companies").select("company_id", { count: "exact", head: true })),
    ]),
  ]);

  const perDay: Bar[] = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(now - (CHART_DAYS - 1 - i) * DAY);
    return { label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: 0 };
  });
  for (const o of recent) {
    const idx = CHART_DAYS - 1 - Math.floor((now - new Date(o.first_seen_at).getTime()) / DAY);
    if (idx >= 0 && idx < CHART_DAYS) perDay[idx].value++;
  }

  const tally = (keys: string[], labels: Record<string, string>) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(labels[k] ?? k, (m.get(labels[k] ?? k) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  // An offer's first source: a search engine, or the ATS whose career page listed it.
  const sources = tally(offers.map((o) => (o.sources[0] ?? "?").split(":")[0]), { ...SOURCE_LABELS, greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workable: "Workable", recruitee: "Recruitee", teamtailor: "Teamtailor", personio: "Personio" });

  const [onboarded, applications, added, favorites] = kpis;
  return {
    activeOffers: offers.length,
    directory: boards.length,
    judgedByAi: scores.filter((s) => s.scored_by === "llm").length,
    onboarded,
    applications,
    added,
    favorites,
    perDay,
    sources,
    origins: tally(boards.map((b) => b.discovered_via ?? "crawl"), ORIGIN_LABELS),
    levels: tally(scores.filter((s) => s.scored_by === "llm").map((s) => s.level), LEVEL_LABELS),
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
