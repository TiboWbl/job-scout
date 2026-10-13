import type { SupabaseClient } from "@supabase/supabase-js";
import { detectContract, detectExperience, detectExperienceLevel, detectRemote, detectSalary } from "@/lib/domain/signals";
import { fromUrl } from "./manual";

// Offers from search engines (Adzuna, Jooble) carry a 500-character excerpt. Judging or showing an
// excerpt as if it were the offer misleads: Scout reads the full posting behind the link once, and
// archives the offer if the link says it is gone.

export const EXCERPT_LENGTH = 1200;
const ENGINES = ["adzuna", "jooble", "careerjet", "france-travail"];

export const isExcerptOnly = (o: { description: string | null; sources: string[] }) =>
  (o.description ?? "").length < EXCERPT_LENGTH && o.sources.every((s) => ENGINES.includes(s));

type Row = { id: string; title: string; description: string | null; apply_url: string; contract: string; remote?: string; sources: string[] };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
// What a closed posting says once it is taken down, on engines and career sites alike.
const EXPIRED = /no longer available|is no longer accepting|has expired|position (has been )?filled|job (is )?closed|n['’]est plus disponible|n['’]est plus en ligne|offre (a )?expir|offre (a été )?pourvue|annonce (a été )?(supprim|retir|expir)/i;

export const isClosedPage = (text: string) => EXPIRED.test(text);

// Whether a posting still exists: gone (404, 410, or a page saying so), alive, or unknown (blocked).
async function liveness(url: string): Promise<{ state: "gone" | "alive" | "unknown"; res: Response | null }> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" } }).catch(() => null);
  if (!res) return { state: "unknown", res };
  if (res.status === 404 || res.status === 410) return { state: "gone", res };
  if (!res.ok) return { state: "unknown", res };
  const html = await res.text().catch(() => "");
  // Only the visible text near the top: the phrase must be the page's message, not a footer link.
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").slice(0, 6000);
  return { state: isClosedPage(text) ? "gone" : "alive", res };
}

async function completeOne(db: SupabaseClient, o: Row): Promise<"full" | "gone" | "excerpt"> {
  const { state, res: head } = await liveness(o.apply_url);
  const now = new Date().toISOString();
  if (state === "gone") {
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
        ...(o.remote === "unknown" && detectRemote(text) ? { remote: detectRemote(text) } : {}),
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

// Engines keep listing postings long after they close: every offer known from engines alone is
// checked again every few days, and archived as soon as its page says it is gone. Excerpts are
// completed on the way. Needs the service role.
export async function verifyEngineOffers(db: SupabaseClient, { limit = 1000, everyDays = 3 } = {}) {
  const cutoff = new Date(Date.now() - everyDays * 86_400_000).toISOString();
  const { data } = await db
    .from("offers")
    .select("id, title, description, apply_url, contract, remote, sources, completed_at")
    .is("archived_at", null)
    .containedBy("sources", ENGINES)
    .or(`completed_at.is.null,completed_at.lt.${cutoff}`)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const todo = (data ?? []) as Row[];
  const tally = { full: 0, gone: 0, excerpt: 0, alive: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < todo.length) {
        const o = todo[next++];
        if (isExcerptOnly(o)) tally[await completeOne(db, o).catch(() => "excerpt" as const)]++;
        else {
          const { state } = await liveness(o.apply_url);
          const now = new Date().toISOString();
          await db.from("offers").update(state === "gone" ? { archived_at: now, completed_at: now } : { completed_at: now }).eq("id", o.id);
          tally[state === "gone" ? "gone" : "alive"]++;
        }
      }
    }),
  );
  return tally;
}

// Needs the service role: offers are shared, users cannot write them.
export async function completeOffers(db: SupabaseClient, ids: string[], concurrency = 6) {
  if (ids.length === 0) return { full: 0, gone: 0, excerpt: 0 };
  const { data } = await db.from("offers").select("id, title, description, apply_url, contract, remote, sources").in("id", ids).is("completed_at", null);
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
