import type { SupabaseClient } from "@supabase/supabase-js";
import { marketInsights, type MarketInsights } from "./advice";
import { loadMarketDataset, profileInputs, type MarketData } from "./compute";
import { inCvCheck } from "@/lib/views/skills";
import { refreshMarket, snapshots } from "./store";

const DAY = 86_400_000;

export type MarketPage = { today: MarketData; since: string | null; trend: Record<string, number>; insights: MarketInsights };

// The latest picture, compared with the one about a week before (or the oldest kept). The very first
// visit computes it on the spot; the daily job keeps it fresh afterwards.
export async function marketPage(db: SupabaseClient, userId: string): Promise<MarketPage | null> {
  let kept = await snapshots(db, userId);
  if (kept.length === 0) {
    await refreshMarket(db, await loadMarketDataset(db), userId);
    kept = await snapshots(db, userId);
  }
  const latest = kept[0]?.data;
  if (!latest) return null;
  // "In your CV" as of now: a CV analysed since the snapshot counts at once.
  const { cvText, cvSkills } = await profileInputs(db, userId, { selection: false });
  const has = inCvCheck(cvText, cvSkills);
  const today: MarketData = { ...latest, skills: latest.skills.map((s) => ({ ...s, inCv: has(s.key ?? "") })) };
  const t = Date.parse(kept[0].day);
  const older = kept.filter((s) => Date.parse(s.day) <= t - 5 * DAY && s.data.role === today.role);
  const ref = older.sort((a, b) => Math.abs(Date.parse(a.day) - (t - 7 * DAY)) - Math.abs(Date.parse(b.day) - (t - 7 * DAY)))[0];
  const trend: Record<string, number> = {};
  if (ref)
    for (const s of today.skills) {
      const before = ref.data.skills.find((r) => r.key === s.key);
      if (before) trend[s.key ?? s.name] = s.share - before.share;
    }
  return { today, since: ref?.day ?? null, trend, insights: marketInsights(today) };
}
