import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria } from "@/lib/domain/criteria";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { fetchBoard, SEED_BOARDS, type Ats, type Board } from "./connectors/ats";
import { fetchFranceTravail, isFranceTravailConfigured } from "./connectors/france-travail";
import { fetchAdzuna, isAdzunaConfigured } from "./connectors/adzuna";
import { extractAccent } from "./colors";
import { companyKey, dedupKey } from "./normalize";

export type SourceReport = { source: string; seen: number; created: number; archived: number; error?: string };

const MAX_GENERATED_QUERIES = 12;
const COLOR_BATCH = 40;
const RETENTION_DAYS = 60;

// Logs stay aggregated: counts per source, never anything about a user.
type Log = (line: string) => void;

export async function runCollection(db: SupabaseClient, log: Log = () => {}): Promise<SourceReport[]> {
  await seedBoards(db);
  const boards = await loadBoards(db);
  const queries = await queriesFromProfiles(db);

  const jobs: { source: string; run: () => Promise<NormalizedOffer[]>; archiveStale: boolean }[] = boards.map((b) => ({
    source: `${b.ats}:${b.token}`,
    run: () => fetchBoard(b),
    archiveStale: true,
  }));
  if (queries.length && isFranceTravailConfigured()) jobs.push({ source: "france-travail", run: () => fetchFranceTravail(queries), archiveStale: false });
  if (queries.length && isAdzunaConfigured()) jobs.push({ source: "adzuna", run: () => fetchAdzuna(queries), archiveStale: false });

  const reports: SourceReport[] = [];
  // A few sources at a time: polite to the APIs, and one failing source never blocks the others.
  for (let i = 0; i < jobs.length; i += 4) {
    const chunk = jobs.slice(i, i + 4);
    reports.push(...(await Promise.all(chunk.map((j) => collectSource(db, j.source, j.run, j.archiveStale)))));
  }
  for (const r of reports) log(`${r.source}: ${r.seen} vues, ${r.created} nouvelles, ${r.archived} archivées${r.error ? ` (erreur)` : ""}`);

  await fillCompanyColors(db);
  await purgeOldDescriptions(db);
  return reports;
}

async function seedBoards(db: SupabaseClient) {
  const rows = SEED_BOARDS.map((b) => ({ name: b.name, name_key: companyKey(b.name), domain: b.domain, ats: b.ats, ats_token: b.token }));
  await db.from("companies").upsert(rows, { onConflict: "name_key", ignoreDuplicates: true });
}

async function loadBoards(db: SupabaseClient): Promise<Board[]> {
  const { data, error } = await db.from("companies").select("name, domain, ats, ats_token").not("ats", "is", null);
  if (error) throw error;
  return (data ?? []).map((c) => ({ name: c.name, domain: c.domain, ats: c.ats as Ats, token: c.ats_token }));
}

// Search queries come only from the profiles in the database: every user widens the coverage.
async function queriesFromProfiles(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("profiles").select("criteria").not("onboarded_at", "is", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const parsed = Criteria.safeParse(row.criteria);
    if (!parsed.success) continue;
    for (const q of [...parsed.data.targetRoles, ...parsed.data.titleVariants]) {
      const key = q.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_GENERATED_QUERIES).map(([q]) => q);
}

async function collectSource(
  db: SupabaseClient,
  source: string,
  fetchOffers: () => Promise<NormalizedOffer[]>,
  archiveStale: boolean,
): Promise<SourceReport> {
  const startedAt = new Date().toISOString();
  const report: SourceReport = { source, seen: 0, created: 0, archived: 0 };
  try {
    const offers = await fetchOffers();
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
  await db.from("collection_runs").insert({
    source,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    offers_seen: report.seen,
    offers_new: report.created,
    offers_archived: report.archived,
    errors: report.error ? 1 : 0,
    error_sample: report.error ?? null,
  });
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

async function upsertOffers(db: SupabaseClient, offers: NormalizedOffer[]): Promise<number> {
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
      const direct = urls.find((u) => /greenhouse|lever|ashby/.test(u.source));
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
