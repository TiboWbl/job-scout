import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria } from "@/lib/domain/criteria";
import { computeMarket, profileInputs, type MarketData, type MarketDataset } from "./compute";

const DAY = 86_400_000;
// The first day every source was in place: before it, the market looked smaller than it was.
export const MARKET_START = "2026-10-08";

export type Snapshot = { day: string; data: MarketData };

export async function snapshots(db: SupabaseClient, profileId: string): Promise<Snapshot[]> {
  const { data } = await db.from("market_snapshots").select("day, data").eq("profile_id", profileId).order("day", { ascending: false }).limit(60);
  return (data ?? []) as Snapshot[];
}

// Today's picture of the person's market, with a week of history rebuilt when there is none yet
// (from what was online each day).
export async function refreshMarket(db: SupabaseClient, set: MarketDataset, profileId: string) {
  const inputs = await profileInputs(db, profileId);
  const criteria = Criteria.parse(inputs.criteria ?? {});
  if (criteria.targetRoles.length === 0) return null;
  const known = await snapshots(db, profileId);
  const today = await computeMarket(set, criteria, { cvText: inputs.cvText, cvSkills: inputs.cvSkills, selection: inputs.selection });

  const rows = [{ profile_id: profileId, day: today.day, data: today }];

  // History once a week back to the start, for the days not kept yet.
  const days = new Set(known.map((s) => s.day));
  const back: number[] = [];
  for (let t = Date.now() - 7 * DAY; new Date(t).toISOString().slice(0, 10) >= MARKET_START; t -= 7 * DAY) back.push(t);
  // The start itself, when the weekly steps miss it by more than three days.
  const start = Date.parse(`${MARKET_START}T12:00:00Z`);
  if (Date.now() - start >= 5 * DAY && !back.some((t) => Math.abs(t - start) < 3 * DAY)) back.push(start);
  for (const t of back) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (days.has(day)) continue;
    rows.push({ profile_id: profileId, day, data: await computeMarket(set, criteria, { at: new Date(t), cvText: inputs.cvText, cvSkills: inputs.cvSkills }) });
  }
  const { error } = await db.from("market_snapshots").upsert(rows, { onConflict: "profile_id,day" });
  if (error) throw error;
  return today;
}
