import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import type { Place, Remote } from "@/lib/domain/offer";
import { chancesCap, prefilter } from "./prefilter";
import { completeOffers, isExcerptOnly } from "@/lib/collect/complete";
import { MIN_INTERVAL_MS } from "@/lib/llm";
import { titleRelevance } from "./relevance";
import { judgeBatch, type JudgeInput, type Judgement } from "./judge";

const BATCH_SIZE = 8;
// A batch of 8 takes ~20-25 s on the free model; with 2.1 s between starts, ~12 fit in one call.
const BATCH_DURATION_MS = 30_000;
const MAX_BATCHES_PER_CALL = 12;
const MIN_TITLE_RELEVANCE = 3;
const HARD_STOP_MS = 52_000;
const PAGE = 1000;

type LightOffer = {
  id: string;
  title: string;
  location_raw: string | null;
  places: Place[];
  remote: Remote;
  remote_scope: string[];
  contract: string;
  experience_min_years: number | null;
  company: { name: string } | null;
};

export type ScoringProgress = { scoredNow: number; remaining: number; total: number };

async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

// Runs as the signed-in user: reads shared offers, writes only this user's scores (RLS).
// `service` (service role) lets the engine complete search-engine excerpts before judging them.
export async function runScoring(db: SupabaseClient, userId: string, budgetMs = 45_000, service: SupabaseClient | null = null): Promise<ScoringProgress> {
  const startedAt = Date.now();
  const { data: profile, error } = await db.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", userId).single();
  if (error || !profile) throw error ?? new Error("profile not found");
  const criteria = Criteria.parse(profile.criteria);
  const cvParsed = profile.cv_summary ? CvSummary.safeParse(profile.cv_summary) : null;
  const cv = cvParsed?.success ? cvParsed.data : null;
  const version: number = profile.criteria_version;
  const experienceYears = criteria.experienceYears ?? cv?.experienceYears ?? null;

  const scored = new Set(
    (await pages<{ offer_id: string }>((f, t) => db.from("offer_scores").select("offer_id").eq("user_id", userId).eq("criteria_version", version).range(f, t))).map(
      (r) => r.offer_id,
    ),
  );
  const offers = await pages<LightOffer>((f, t) =>
    db
      .from("offers")
      .select("id, title, location_raw, places, remote, remote_scope, contract, experience_min_years, company:companies(name)")
      .is("archived_at", null)
      .order("first_seen_at", { ascending: false })
      .range(f, t) as unknown as PromiseLike<{ data: LightOffer[] | null; error: unknown }>,
  );
  const unscored = offers.filter((o) => !scored.has(o.id));

  const base = { user_id: userId, criteria_version: version };
  const gateRows: Record<string, unknown>[] = [];
  const passed: { offer: LightOffer; outOfZone: boolean; gap: number }[] = [];
  for (const offer of unscored) {
    const gate = prefilter({ ...offer, companyName: offer.company?.name ?? "" }, criteria, experienceYears);
    if (gate.pass) passed.push({ offer, outOfZone: gate.outOfZone, gap: gate.experienceGap });
    else gateRows.push({ ...base, offer_id: offer.id, level: "ecartee", excluded_reason: gate.reason, scored_by: "prefilter" });
  }

  // Only offers whose title is close to a role sought or a bridge reach the LLM; the others are
  // set aside with that reason, still visible under "Écartées".
  const candidates: { offer: LightOffer; outOfZone: boolean; gap: number; rel: number }[] = [];
  for (const p of passed) {
    const rel = titleRelevance(p.offer.title, criteria);
    if (rel >= MIN_TITLE_RELEVANCE) candidates.push({ ...p, rel });
    else
      gateRows.push({
        ...base,
        offer_id: p.offer.id,
        level: "ecartee",
        excluded_reason: "L'intitulé ne correspond à aucun de tes métiers ni de tes passerelles.",
        scored_by: "prefilter",
      });
  }
  for (let i = 0; i < gateRows.length; i += 500) {
    const { error: e } = await db.from("offer_scores").upsert(gateRows.slice(i, i + 500));
    if (e) throw e;
  }
  // The gates take a second: report them at once so progress moves before the slower LLM part.
  if (gateRows.length > 0) return { scoredNow: gateRows.length, remaining: candidates.length, total: offers.length };

  candidates.sort((a, b) => b.rel - a.rel);
  const { data: favs } = await db.from("favorite_companies").select("company:companies(name)").eq("user_id", userId);
  const favoriteNames = (favs ?? []).map((f) => (f.company as unknown as { name: string } | null)?.name).filter((n): n is string => Boolean(n));
  const descriptions = new Map<string, string>();
  const excerpts = new Set<string>();
  const toLoad = candidates.slice(0, MAX_BATCHES_PER_CALL * BATCH_SIZE).map((c) => c.offer.id);
  // Read the full posting behind search-engine excerpts first: judging 500 characters misleads.
  if (service) await completeOffers(service, toLoad);
  const fresh = new Map<string, { description: string | null; experience_min_years: number | null; contract: string; archived_at: string | null; sources: string[] }>();
  for (let i = 0; i < toLoad.length; i += 100) {
    const { data } = await db.from("offers").select("id, description, experience_min_years, contract, archived_at, sources").in("id", toLoad.slice(i, i + 100));
    for (const d of data ?? []) fresh.set(d.id, d);
  }
  // Completed offers may now ask for more experience, or be gone: the gates are applied again.
  const regated: Record<string, unknown>[] = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    const f = fresh.get(c.offer.id);
    if (!f) continue;
    if (f.archived_at) {
      candidates.splice(i, 1);
      continue;
    }
    c.offer = { ...c.offer, experience_min_years: f.experience_min_years, contract: f.contract };
    const gate = prefilter({ ...c.offer, companyName: c.offer.company?.name ?? "" }, criteria, experienceYears);
    if (!gate.pass) {
      regated.push({ ...base, offer_id: c.offer.id, level: "ecartee", excluded_reason: gate.reason, scored_by: "prefilter" });
      candidates.splice(i, 1);
      continue;
    }
    c.gap = gate.experienceGap;
    descriptions.set(c.offer.id, f.description ?? "");
    if (isExcerptOnly({ description: f.description, sources: f.sources })) excerpts.add(c.offer.id);
  }
  if (regated.length > 0) {
    const { error: e } = await db.from("offer_scores").upsert(regated);
    if (e) throw e;
  }

  // Batches start every ~2 s (rate limit) and run side by side; none starts too late to finish
  // within the serverless time limit.
  let scoredNow = 0;
  let missed = 0;
  let finished = 0;
  const running: Promise<void>[] = [];
  while (candidates.length > 0 && running.length < MAX_BATCHES_PER_CALL && Date.now() - startedAt < budgetMs - BATCH_DURATION_MS) {
    const batch = candidates.splice(0, BATCH_SIZE);
    const inputs: JudgeInput[] = batch.map(({ offer }) => ({
      id: offer.id,
      title: offer.title,
      company: offer.company?.name ?? "",
      location: offer.location_raw ?? "",
      contract: offer.contract,
      experienceRequired: offer.experience_min_years,
      description: descriptions.get(offer.id) ?? "",
      excerpt: excerpts.has(offer.id),
    }));
    running.push(
      judgeBatch(inputs, criteria, cv, experienceYears, favoriteNames).then(async (results) => {
        const rows = batch
          .filter(({ offer }) => results.has(offer.id))
          .map(({ offer, outOfZone, gap }) => scoreRow(base, offer.id, outOfZone, gap, results.get(offer.id)!, experienceYears, offer.experience_min_years, service));
        if (rows.length > 0) {
          const { error: e } = await db.from("offer_scores").upsert(rows);
          if (e) throw e;
        }
        scoredNow += rows.length;
        // Offers the model skipped stay unscored and are picked up again by the next call.
        missed += batch.length - rows.length;
      }).finally(() => finished++),
    );
    // Launch at the queue's pace, so the time check above reflects when the batch really starts.
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS));
  }
  // Hard stop before the platform limit: unfinished batches are simply scored again next call.
  const all = Promise.allSettled(running);
  const settled = await Promise.race([all, new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, startedAt + HARD_STOP_MS - Date.now())))]);
  const failures = settled ? settled.filter((r): r is PromiseRejectedResult => r.status === "rejected") : [];
  if (failures.length > 0 && scoredNow === 0) throw failures[0].reason;
  const unfinished = running.length - finished + failures.length;

  return { scoredNow, remaining: candidates.length + missed + unfinished * BATCH_SIZE, total: offers.length };
}

// The experience gate keeps its word whatever the model thought of the chances. When the model found
// the years asked (with a verified quote) and the detector had not, the gate applies with them, and the
// shared offer learns them for everyone.
function scoreRow(
  base: { user_id: string; criteria_version: number },
  offerId: string,
  outOfZone: boolean,
  gap: number,
  judged: Judgement,
  experienceYears: number | null,
  knownYears: number | null,
  service: SupabaseClient | null,
): Record<string, unknown> {
  const { experience_years: found, ...rest } = judged;
  let effectiveGap = gap;
  if (knownYears === null && found !== null) {
    if (service) void service.from("offers").update({ experience_min_years: found }).eq("id", offerId).is("experience_min_years", null);
    if (experienceYears !== null) {
      effectiveGap = Math.max(gap, found - experienceYears);
      if (found - experienceYears >= 4)
        return { ...base, offer_id: offerId, out_of_zone: outOfZone, ...rest, level: "ecartee", excluded_reason: `${found} ans d'expérience demandés, ${experienceYears} de ton côté.`, scored_by: "llm" };
    }
  }
  return { ...base, offer_id: offerId, out_of_zone: outOfZone, ...rest, score_chances: Math.min(rest.score_chances, chancesCap(effectiveGap)), scored_by: "llm" };
}

// An offer the person added themselves: same gates and judgement, no title pre-sort, right away.
export async function scoreOffersNow(db: SupabaseClient, userId: string, offerIds: string[]) {
  const { data: profile, error } = await db.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", userId).single();
  if (error || !profile) throw error ?? new Error("profile not found");
  const criteria = Criteria.parse(profile.criteria);
  const cvParsed = profile.cv_summary ? CvSummary.safeParse(profile.cv_summary) : null;
  const cv = cvParsed?.success ? cvParsed.data : null;
  const experienceYears = criteria.experienceYears ?? cv?.experienceYears ?? null;
  const base = { user_id: userId, criteria_version: profile.criteria_version as number };

  const { data: offers } = await db
    .from("offers")
    .select("id, title, location_raw, places, remote, remote_scope, contract, experience_min_years, description, company:companies(name)")
    .in("id", offerIds);
  const rows: Record<string, unknown>[] = [];
  const toJudge: { offer: LightOffer & { description: string | null }; outOfZone: boolean; gap: number }[] = [];
  for (const offer of (offers ?? []) as unknown as (LightOffer & { description: string | null })[]) {
    const gate = prefilter({ ...offer, companyName: offer.company?.name ?? "" }, criteria, experienceYears);
    if (gate.pass) toJudge.push({ offer, outOfZone: gate.outOfZone, gap: gate.experienceGap });
    else rows.push({ ...base, offer_id: offer.id, level: "ecartee", excluded_reason: gate.reason, scored_by: "prefilter" });
  }
  if (toJudge.length > 0) {
    const { data: favs } = await db.from("favorite_companies").select("company:companies(name)").eq("user_id", userId);
    const favoriteNames = (favs ?? []).map((f) => (f.company as unknown as { name: string } | null)?.name).filter((n): n is string => Boolean(n));
    const results = await judgeBatch(
      toJudge.map(({ offer }) => ({
        id: offer.id,
        title: offer.title,
        company: offer.company?.name ?? "",
        location: offer.location_raw ?? "",
        contract: offer.contract,
        experienceRequired: offer.experience_min_years,
        description: offer.description ?? "",
      })),
      criteria,
      cv,
      experienceYears,
      favoriteNames,
    );
    for (const { offer, outOfZone, gap } of toJudge) {
      const judged = results.get(offer.id);
      if (judged) rows.push(scoreRow(base, offer.id, outOfZone, gap, judged, experienceYears, offer.experience_min_years, null));
    }
  }
  if (rows.length > 0) {
    const { error: e } = await db.from("offer_scores").upsert(rows);
    if (e) throw e;
  }
  return rows;
}
