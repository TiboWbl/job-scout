import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria } from "@/lib/domain/criteria";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { fetchBoard, SEED_BOARDS, type Ats, type Board } from "./connectors/ats";
import type { Keep } from "./connectors/ats-more";
import { fetchFranceTravail, isFranceTravailConfigured } from "./connectors/france-travail";
import { fetchAdzuna, isAdzunaConfigured, type SearchQuery } from "./connectors/adzuna";
import { fetchJooble, isJoobleConfigured } from "./connectors/jooble";
import { extractAccent } from "./colors";
import { companyKey, dedupKey } from "./normalize";

export type SourceReport = { source: string; seen: number; created: number; archived: number; error?: string };

const MAX_GENERATED_QUERIES = 8;
const COLOR_BATCH = 40;
const RETENTION_DAYS = 60;
const BOARD_CONCURRENCY = 6;

// Logs stay aggregated: counts per source, never anything about a user.
type Log = (line: string) => void;
type Options = { log?: Log; budgetMs?: number };

type Scope = { queries: SearchQuery[]; countries: Set<string> };

export async function runCollection(db: SupabaseClient, { log = () => {}, budgetMs = Infinity }: Options = {}): Promise<SourceReport[]> {
  const startedAt = Date.now();
  await seedBoards(db);
  const scope = await scopeFromProfiles(db);
  const keep = keepInScope(scope);
  const reports: SourceReport[] = [];

  // Search engines first: they bring the most offers for the people actually using Scout.
  const engines: { source: string; run: () => Promise<NormalizedOffer[]> }[] = [];
  if (scope.queries.length && isAdzunaConfigured()) engines.push({ source: "adzuna", run: () => fetchAdzuna(scope.queries) });
  if (scope.queries.length && isJoobleConfigured()) engines.push({ source: "jooble", run: () => fetchJooble(scope.queries) });
  if (scope.queries.length && isFranceTravailConfigured()) engines.push({ source: "france-travail", run: () => fetchFranceTravail(scope.queries.map((q) => q.what)) });
  reports.push(...(await Promise.all(engines.map((e) => collectSource(db, e.source, e.run, false, keep)))));

  // Then career pages, least recently collected first, as many as the time budget allows.
  const boards = await loadBoards(db);
  const byAts = new Map<string, SourceReport>();
  let next = 0;
  const worker = async () => {
    while (next < boards.length && Date.now() - startedAt < budgetMs) {
      const board = boards[next++];
      const r = await collectBoard(db, board, keep);
      const agg = byAts.get(board.ats) ?? { source: board.ats, seen: 0, created: 0, archived: 0 };
      agg.seen += r.seen;
      agg.created += r.created;
      agg.archived += r.archived;
      if (r.error && !agg.error) agg.error = `${board.token}: ${r.error}`;
      byAts.set(board.ats, agg);
    }
  };
  await Promise.all(Array.from({ length: BOARD_CONCURRENCY }, worker));
  for (const agg of byAts.values()) {
    reports.push(agg);
    await recordRun(db, agg, new Date(startedAt).toISOString());
  }
  log(`pages carrière lues : ${next} sur ${boards.length}`);
  for (const r of reports) log(`${r.source}: ${r.seen} vues, ${r.created} nouvelles, ${r.archived} archivées${r.error ? " (erreur)" : ""}`);

  if (Date.now() - startedAt < budgetMs) {
    await fillCompanyColors(db);
    await purgeOldDescriptions(db);
  }
  return reports;
}

async function seedBoards(db: SupabaseClient) {
  const rows = SEED_BOARDS.map((b) => ({ name: b.name, name_key: companyKey(b.name), domain: b.domain, ats: b.ats, ats_token: b.token, discovered_via: "seed" }));
  await db.from("companies").upsert(rows, { onConflict: "name_key", ignoreDuplicates: true });
}

async function loadBoards(db: SupabaseClient): Promise<(Board & { id: string })[]> {
  const out: (Board & { id: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("companies")
      .select("id, name, domain, ats, ats_token")
      .not("ats", "is", null)
      .order("last_collected_at", { ascending: true, nullsFirst: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map((c) => ({ id: c.id, name: c.name, domain: c.domain, ats: c.ats as Ats, token: c.ats_token })));
    if (!data || data.length < 1000) return out;
  }
}

// Search queries and kept countries come only from the profiles in the database: every user widens
// the coverage, and nothing is stored for places nobody is looking at (the free database is 500 MB).
export async function scopeFromProfiles(db: SupabaseClient): Promise<Scope> {
  const { data } = await db.from("profiles").select("criteria").not("onboarded_at", "is", null);
  const counts = new Map<string, { q: SearchQuery; n: number }>();
  const countries = new Set<string>();
  for (const row of data ?? []) {
    const parsed = Criteria.safeParse(row.criteria);
    if (!parsed.success) continue;
    const c = parsed.data;
    for (const p of c.zone.places) countries.add(p.country);
    const where = c.zone.places.find((p) => p.kind !== "country")?.label ?? c.zone.places[0]?.label ?? null;
    for (const what of [...c.targetRoles, ...c.titleVariants]) {
      const key = `${what.trim().toLowerCase()}|${where ?? ""}`;
      const prev = counts.get(key);
      counts.set(key, { q: { what: what.trim(), where }, n: (prev?.n ?? 0) + 1 });
    }
  }
  const queries = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, MAX_GENERATED_QUERIES).map((x) => x.q);
  return { queries, countries };
}

export function keepInScope(scope: Scope): Keep {
  // No profile yet: keep everything rather than nothing.
  if (scope.countries.size === 0) return () => true;
  return (places) => places.length === 0 || places.some((p) => !p.country || scope.countries.has(p.country));
}

async function collectBoard(db: SupabaseClient, board: Board & { id: string }, keep: Keep): Promise<SourceReport> {
  const startedAt = new Date().toISOString();
  const source = `${board.ats}:${board.token}`;
  const report: SourceReport = { source, seen: 0, created: 0, archived: 0 };
  try {
    const all = await fetchBoard(board, keep);
    const offers = all.filter((o) => keep(o.places, o.remote));
    report.seen = offers.length;
    report.created = await upsertOffers(db, offers);
    // The board lists every open position: what is no longer there has been filled or withdrawn.
    const { data } = await db
      .from("offers")
      .update({ archived_at: new Date().toISOString() })
      .contains("sources", [source])
      .lt("last_seen_at", startedAt)
      .is("archived_at", null)
      .select("id");
    report.archived = data?.length ?? 0;
    await db.from("companies").update({ last_collected_at: new Date().toISOString() }).eq("id", board.id);
  } catch (error) {
    report.error = (error as Error).message.slice(0, 120);
    // A board that no longer exists is dropped from the rotation; discovery may find it again.
    if (/HTTP 404/.test(report.error)) await db.from("companies").update({ ats: null, ats_token: null }).eq("id", board.id);
    else await db.from("companies").update({ last_collected_at: new Date().toISOString() }).eq("id", board.id);
  }
  return report;
}

async function recordRun(db: SupabaseClient, r: SourceReport, startedAt: string) {
  await db.from("collection_runs").insert({
    source: r.source,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    offers_seen: r.seen,
    offers_new: r.created,
    offers_archived: r.archived,
    errors: r.error ? 1 : 0,
    error_sample: r.error ?? null,
  });
}

async function collectSource(db: SupabaseClient, source: string, fetchOffers: () => Promise<NormalizedOffer[]>, archiveStale: boolean, keep: Keep): Promise<SourceReport> {
  const startedAt = new Date().toISOString();
  const report: SourceReport = { source, seen: 0, created: 0, archived: 0 };
  try {
    const offers = (await fetchOffers()).filter((o) => keep(o.places, o.remote));
    report.seen = offers.length;
    report.created = await upsertOffers(db, offers);
    if (archiveStale && offers.length > 0) {
      const { data } = await db
        .from("offers")
        .update({ archived_at: new Date().toISOString() })
        .contains("sources", [source])
        .lt("last_seen_at", startedAt)
        .is("archived_at", null)
        .select("id");
      report.archived = data?.length ?? 0;
    }
  } catch (error) {
    report.error = (error as Error).message.slice(0, 200);
  }
  await recordRun(db, report, startedAt);
  return report;
}

async function ensureCompanies(db: SupabaseClient, offers: NormalizedOffer[]) {
  const byKey = new Map<string, NormalizedOffer["company"]>();
  for (const o of offers) byKey.set(companyKey(o.company.name), o.company);
  const keys = [...byKey.keys()];
  const ids = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 200) {
    const slice = keys.slice(i, i + 200);
    const { data: existing } = await db.from("companies").select("id, name_key").in("name_key", slice);
    for (const c of existing ?? []) ids.set(c.name_key, c.id);
    const missing = slice.filter((k) => !ids.has(k)).map((k) => ({ name: byKey.get(k)!.name, name_key: k, domain: byKey.get(k)!.domain ?? null }));
    if (missing.length) {
      const { data: inserted, error } = await db.from("companies").upsert(missing, { onConflict: "name_key" }).select("id, name_key");
      if (error) throw error;
      for (const c of inserted ?? []) ids.set(c.name_key, c.id);
    }
  }
  return ids;
}

export async function upsertOffers(db: SupabaseClient, offers: NormalizedOffer[]): Promise<number> {
  if (offers.length === 0) return 0;
  const companyIds = await ensureCompanies(db, offers);
  const now = new Date().toISOString();

  const byKey = new Map<string, NormalizedOffer>();
  for (const o of offers) byKey.set(dedupKey(o.company.name, o.title, o.places[0]?.city), o);
  const keys = [...byKey.keys()];
  let created = 0;

  for (let i = 0; i < keys.length; i += 100) {
    const slice = keys.slice(i, i + 100);
    const { data: existing, error } = await db.from("offers").select("dedup_key, sources, urls, description").in("dedup_key", slice);
    if (error) throw error;
    const known = new Map((existing ?? []).map((e) => [e.dedup_key, e]));

    const rows = slice.map((key) => {
      const o = byKey.get(key)!;
      const prev = known.get(key);
      const urls: { source: string; url: string }[] = prev?.urls ?? [];
      if (!urls.some((u) => u.url === o.sourceUrl)) urls.push({ source: o.sourceKey, url: o.sourceUrl });
      // Prefer the company's own page for applying when one is known.
      const direct = urls.find((u) => /greenhouse|lever|ashby|smartrecruiters|workable|recruitee|teamtailor|personio/.test(u.source));
      const prevDesc: string = prev?.description ?? "";
      return {
        dedup_key: key,
        company_id: companyIds.get(companyKey(o.company.name)),
        title: o.title,
        location_raw: o.locationRaw,
        places: o.places,
        remote: o.remote,
        remote_scope: o.remoteScope,
        contract: o.contract,
        experience_min_years: o.experienceMinYears,
        description: o.description.length >= prevDesc.length ? o.description : prevDesc,
        apply_url: direct?.url ?? o.applyUrl,
        urls,
        sources: Array.from(new Set([...(prev?.sources ?? []), o.sourceKey])),
        published_at: o.publishedAt,
        last_seen_at: now,
        archived_at: null,
      };
    });
    created += rows.filter((r) => !known.has(r.dedup_key)).length;
    const { error: upsertError } = await db.from("offers").upsert(rows, { onConflict: "dedup_key" });
    if (upsertError) throw upsertError;
  }
  return created;
}

async function fillCompanyColors(db: SupabaseClient) {
  const { data } = await db.from("companies").select("id, domain").not("domain", "is", null).is("color_checked_at", null).limit(COLOR_BATCH);
  for (const c of data ?? []) {
    let accent: string | null = null;
    try {
      accent = await extractAccent(c.domain);
    } catch {
      accent = null;
    }
    await db.from("companies").update({ accent_color: accent, color_checked_at: new Date().toISOString() }).eq("id", c.id);
  }
}

async function purgeOldDescriptions(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await db.from("offers").update({ description: null }).lt("archived_at", cutoff).not("description", "is", null);
}
