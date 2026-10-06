import type { SupabaseClient } from "@supabase/supabase-js";
import { ATS_LIST, fetchBoard, type Ats } from "./connectors/ats";
import { smartrecruitersHasOffer, type Keep } from "./connectors/ats-more";
import { companyKey, slug } from "./normalize";
import { keepInScope, scopeFromProfiles } from "./run";

// Grows the shared directory of career pages, legally: public crawl index and public ATS APIs.
// A company joins the directory only if its board currently lists an offer where someone looks.

export type Candidate = { ats: Ats; token: string; via: "crawl" | "name" };
export type DiscoveryReport = { candidates: number; checked: number; added: number; byAts: Record<string, number> };

const CC_COLLECTIONS = "https://index.commoncrawl.org/collinfo.json";
const CC_DOMAINS: { ats: Ats; domain: string; slug: RegExp }[] = [
  { ats: "greenhouse", domain: "boards.greenhouse.io", slug: /^https?:\/\/boards\.greenhouse\.io\/([^/?#]+)/i },
  { ats: "greenhouse", domain: "job-boards.greenhouse.io", slug: /^https?:\/\/job-boards\.greenhouse\.io\/([^/?#]+)/i },
  { ats: "lever", domain: "jobs.lever.co", slug: /^https?:\/\/jobs\.lever\.co\/([^/?#]+)/i },
  { ats: "ashby", domain: "jobs.ashbyhq.com", slug: /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)/i },
  { ats: "smartrecruiters", domain: "jobs.smartrecruiters.com", slug: /^https?:\/\/jobs\.smartrecruiters\.com\/([^/?#]+)/i },
  { ats: "workable", domain: "apply.workable.com", slug: /^https?:\/\/apply\.workable\.com\/([^/?#]+)/i },
  { ats: "recruitee", domain: "recruitee.com", slug: /^https?:\/\/([a-z0-9-]+)\.recruitee\.com/i },
  { ats: "teamtailor", domain: "teamtailor.com", slug: /^https?:\/\/([a-z0-9-]+)\.teamtailor\.com/i },
  { ats: "personio", domain: "jobs.personio.de", slug: /^https?:\/\/([a-z0-9-]+)\.jobs\.personio\.de/i },
];
const NOT_A_COMPANY = new Set(["www", "api", "embed", "v1", "app", "career", "careers", "jobs", "oauth", "static", "assets", "j", "widget", "login"]);

async function fetchText(url: string, timeoutMs = 60_000, tries = 2): Promise<string> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.text();
      if (res.status === 404) return "";
      throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      if (i + 1 >= tries) throw error;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

// Slugs seen in the latest crawls of the public Common Crawl index (one request per domain and crawl).
export async function crawlCandidates(crawls = 3, log: (l: string) => void = () => {}): Promise<Candidate[]> {
  const collections = JSON.parse(await fetchText(CC_COLLECTIONS)) as { id: string; "cdx-api": string }[];
  const found = new Map<string, Candidate>();
  for (const col of collections.slice(0, crawls)) {
    for (const d of CC_DOMAINS) {
      let body = "";
      try {
        body = await fetchText(`${col["cdx-api"]}?url=${d.domain}&matchType=domain&output=json&fl=url`);
      } catch {
        log(`${col.id} ${d.domain}: index indisponible`);
        continue;
      }
      for (const line of body.split("\n")) {
        const url = line.match(/"url":\s*"([^"]+)"/)?.[1];
        const token = url?.match(d.slug)?.[1]?.toLowerCase();
        if (token && !NOT_A_COMPANY.has(token)) found.set(`${d.ats}:${token}`, { ats: d.ats, token, via: "crawl" });
      }
    }
  }
  return [...found.values()];
}

// Likely board slugs for a company name, as companies usually name them.
export function slugGuesses(name: string): string[] {
  const words = slug(companyKey(name)).split(" ").filter(Boolean);
  if (words.join("").length < 2) return [];
  return Array.from(new Set([words.join(""), words.join("-")]));
}

// Companies seen in search-engine offers that have never been checked for a career page.
export async function nameCandidates(db: SupabaseClient, limit: number): Promise<{ candidates: Candidate[]; companyIds: string[] }> {
  const { data } = await db.from("companies").select("id, name").is("ats", null).is("ats_checked_at", null).limit(limit);
  const candidates: Candidate[] = [];
  // Anonymous postings ("Entreprise non communiquée") have no career page to find.
  const named = (data ?? []).filter((c) => !/non communiqu|confidenti|anonyme/i.test(c.name));
  // DigitalRecruiters and Welcome Kit boards are named by a domain or a reference: never guessed from a name.
  for (const c of named) for (const token of slugGuesses(c.name)) for (const ats of ATS_LIST.filter((a) => a !== "digitalrecruiters" && a !== "welcomekit")) candidates.push({ ats, token, via: "name" });
  return { candidates, companyIds: (data ?? []).map((c) => c.id) };
}

// "acme-sport" → "Acme Sport", for boards whose API does not give the company name (Lever, Ashby).
function prettify(token: string) {
  return token.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function addCompany(db: SupabaseClient, c: Candidate, name: string): Promise<boolean> {
  const { data: same } = await db.from("companies").select("id").eq("ats", c.ats).eq("ats_token", c.token).maybeSingle();
  if (same) return false;
  const key = companyKey(name);
  const { data: existing } = await db.from("companies").select("id, ats").eq("name_key", key).maybeSingle();
  if (existing?.ats) return false;
  const row = { ats: c.ats, ats_token: c.token, discovered_via: c.via, ats_checked_at: new Date().toISOString() };
  if (existing) await db.from("companies").update(row).eq("id", existing.id);
  else await db.from("companies").insert({ name, name_key: key, ...row });
  return true;
}

export async function discover(db: SupabaseClient, candidates: Candidate[], { concurrency = 10, log = (() => {}) as (line: string) => void } = {}): Promise<DiscoveryReport> {
  const keep: Keep = keepInScope(await scopeFromProfiles(db));
  const { data: known } = await db.from("companies").select("ats, ats_token").not("ats", "is", null);
  const knownKeys = new Set((known ?? []).map((k) => `${k.ats}:${k.ats_token}`));
  const todo = candidates.filter((c) => !knownKeys.has(`${c.ats}:${c.token}`));
  const report: DiscoveryReport = { candidates: todo.length, checked: 0, added: 0, byAts: {} };

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const c = todo[next++];
      try {
        // Validation reads the public board once; nothing is stored unless it has an offer in scope.
        let name: string | null = null;
        if (c.ats === "smartrecruiters") name = (await smartrecruitersHasOffer(c.token, keep))?.name ?? null;
        else name = (await fetchBoard({ name: c.token, domain: null, ats: c.ats, token: c.token }, keep)).find((o) => keep(o.places, o.remote))?.company.name ?? null;
        if (name && (await addCompany(db, c, name === c.token ? prettify(c.token) : name))) {
          report.added++;
          report.byAts[c.ats] = (report.byAts[c.ats] ?? 0) + 1;
        }
      } catch {
        // Not a board on this ATS, or unreachable: nothing to record.
      }
      report.checked++;
      if (report.checked % 200 === 0) log(`${report.checked} / ${todo.length} vérifiées, ${report.added} ajoutées`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return report;
}

export async function markNamesChecked(db: SupabaseClient, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) await db.from("companies").update({ ats_checked_at: new Date().toISOString() }).in("id", ids.slice(i, i + 200)).is("ats", null);
}
