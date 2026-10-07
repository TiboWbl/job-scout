import type { SupabaseClient } from "@supabase/supabase-js";
import { detectContract, detectExperience, detectExperienceLevel, detectSalary } from "@/lib/domain/signals";
import { fromUrl } from "./manual";

// Offers from search engines (Adzuna, Jooble) carry a 500-character excerpt. Judging or showing an
// excerpt as if it were the offer misleads: Scout reads the full posting behind the link once, and
// archives the offer if the link says it is gone.

export const EXCERPT_LENGTH = 1200;
const ENGINES = ["adzuna", "jooble", "france-travail"];

export const isExcerptOnly = (o: { description: string | null; sources: string[] }) =>
  (o.description ?? "").length < EXCERPT_LENGTH && o.sources.every((s) => ENGINES.includes(s));

type Row = { id: string; title: string; description: string | null; apply_url: string; contract: string; sources: string[] };

async function completeOne(db: SupabaseClient, o: Row): Promise<"full" | "gone" | "excerpt"> {
  const head = await fetch(o.apply_url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; Scout job aggregator)" } }).catch(() => null);
  const now = new Date().toISOString();
  if (head && (head.status === 404 || head.status === 410)) {
    await db.from("offers").update({ archived_at: now, completed_at: now }).eq("id", o.id);
    return "gone";
  }
  const full = head?.ok ? await fromUrl(head.url).catch(() => null) : null;
  const text = full?.description ?? "";
  if (text.length > (o.description ?? "").length + 200) {
    await db
      .from("offers")
      .update({
        description: text,
        experience_min_years: detectExperience(text).min,
        experience_max_years: detectExperience(text).max,
        experience_level: detectExperienceLevel(text),
        salary_text: detectSalary(text),
        contract: o.contract === "unknown" ? detectContract(o.title, null, text) : o.contract,
        // The employer's own page beats a search-engine redirect for applying.
        ...(full && /greenhouse|lever|ashby|smartrecruiters|workable|recruitee|teamtailor|personio/.test(head!.url) ? { apply_url: head!.url } : {}),
        completed_at: now,
      })
      .eq("id", o.id);
    return "full";
  }
  await db.from("offers").update({ completed_at: now }).eq("id", o.id);
  return "excerpt";
}

// Needs the service role: offers are shared, users cannot write them.
export async function completeOffers(db: SupabaseClient, ids: string[], concurrency = 6) {
  if (ids.length === 0) return { full: 0, gone: 0, excerpt: 0 };
  const { data } = await db.from("offers").select("id, title, description, apply_url, contract, sources").in("id", ids).is("completed_at", null);
  const todo = ((data ?? []) as Row[]).filter(isExcerptOnly);
  const tally = { full: 0, gone: 0, excerpt: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < todo.length) tally[await completeOne(db, todo[next++]).catch(() => "excerpt" as const)]++;
    }),
  );
  return tally;
}
