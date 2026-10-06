import type { SupabaseClient } from "@supabase/supabase-js";
import { ATS_LIST, type Ats } from "./connectors/ats";
import { slugGuesses } from "./discover";
import { companyKey } from "./normalize";
import { collectBoard, keepInScope, scopeFromProfiles } from "./run";

// Turns what a person types (a company name or a career-page URL) into a company of the shared
// directory, finds its public career page when there is one, and reads it at once.

const NOT_A_COMPANY = new Set(["www", "api", "embed", "v1", "app", "careers", "jobs", "j", "widget", "boards", "job_board"]);
const PATTERNS: [Ats, RegExp][] = [
  ["greenhouse", /greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([a-z0-9_-]+)/i],
  ["greenhouse", /(?:job-)?boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?([a-z0-9_-]+)/i],
  ["lever", /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_.-]+)/i],
  ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i],
  ["smartrecruiters", /(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/i],
  ["workable", /apply\.workable\.com\/([a-z0-9_-]+)/i],
  ["recruitee", /([a-z0-9-]+)\.recruitee\.com/i],
  ["teamtailor", /([a-z0-9-]+)\.teamtailor\.com/i],
  ["personio", /([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/i],
];

export function atsFromText(text: string): { ats: Ats; token: string } | null {
  for (const [ats, re] of PATTERNS) {
    for (const m of text.matchAll(new RegExp(re, "gi"))) {
      const token = decodeURIComponent(m[1]).toLowerCase();
      if (!NOT_A_COMPANY.has(token)) return { ats, token };
    }
  }
  return null;
}

export type Resolution = { companyId: string; name: string; found: boolean; platform: string | null; offers: number };
export type Entry = { name?: string; site?: string };

const isUrl = (s: string) => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s);
const prettify = (token: string) => token.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const TIMEOUT = 8_000;
const BROWSER = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Accept-Language": "fr-FR,fr;q=0.9" };

// Career platforms Scout cannot read (no public API, or not a legal source): named, not ignored.
const PLATFORMS: [string, RegExp][] = [
  ["Welcome to the Jungle", /welcometothejungle\.com\/[a-z]{2}\/companies\/[a-z0-9-]+|welcomekit\.co/i],
  ["Workday", /myworkdayjobs\.com/i],
  ["SuccessFactors", /successfactors\.(com|eu)|jobs\.sap\.com/i],
  ["Taleo", /taleo\.net/i],
  ["Talentsoft", /talent-soft\.com|talentsoft/i],
  ["DigitalRecruiters", /digitalrecruiters\.com/i],
  ["Jobaffinity", /jobaffinity\.fr/i],
  ["Flatchr", /flatchr\.io/i],
  ["Taleez", /taleez\.com/i],
  ["iCIMS", /icims\.com/i],
];

async function page(url: string): Promise<{ url: string; html: string } | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: BROWSER, redirect: "follow" }).catch(() => null);
  return res?.ok ? { url: res.url, html: await res.text().catch(() => "") } : null;
}

// Light checks, all in parallel: does this ATS have a non-empty board under this slug?
const BOARD_CHECKS: Record<Ats, (t: string) => [string, (body: string) => boolean]> = {
  greenhouse: (t) => [`https://boards-api.greenhouse.io/v1/boards/${t}/jobs`, (b) => /"jobs":\[\{/.test(b)],
  lever: (t) => [`https://api.lever.co/v0/postings/${t}?mode=json&limit=1`, (b) => b.trim().startsWith("[{")],
  ashby: (t) => [`https://api.ashbyhq.com/posting-api/job-board/${t}`, (b) => /"jobs":\[\{/.test(b)],
  smartrecruiters: (t) => [`https://api.smartrecruiters.com/v1/companies/${t}/postings?limit=1`, (b) => /"totalFound":[1-9]/.test(b)],
  workable: (t) => [`https://apply.workable.com/api/v1/widget/accounts/${t}`, (b) => /"jobs":\[\{/.test(b)],
  recruitee: (t) => [`https://${t}.recruitee.com/api/offers/`, (b) => /"offers":\[\{/.test(b)],
  teamtailor: (t) => [`https://${t}.teamtailor.com/jobs.rss`, (b) => b.includes("<item>")],
  personio: (t) => [`https://${t}.jobs.personio.de/xml`, (b) => b.includes("<position>")],
};

async function probeName(name: string): Promise<{ ats: Ats; token: string } | null> {
  const guesses = slugGuesses(name).flatMap((token) => ATS_LIST.map((ats) => ({ ats, token })));
  const hits = await Promise.all(
    guesses.map(async (g) => {
      const [url, ok] = BOARD_CHECKS[g.ats](g.token);
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { "User-Agent": "Scout job aggregator" } }).catch(() => null);
      return res?.ok && ok(await res.text().catch(() => "")) ? g : null;
    }),
  );
  return hits.find(Boolean) ?? null;
}

// From the company's site: the careers link on its homepage and the usual addresses, in parallel.
async function exploreSite(site: string): Promise<{ board: { ats: Ats; token: string } | null; platform: string | null; careersUrl: string | null }> {
  const root = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
  const host = root.hostname.replace(/^www\./, "");
  const home = await page(root.href);
  const candidates = new Set([`https://${host}/careers`, `https://${host}/carrieres`, `https://${host}/jobs`, `https://${host}/recrutement`, `https://${host}/nous-rejoindre`, `https://jobs.${host}`, `https://careers.${host}`]);
  for (const m of home?.html.matchAll(/href="([^"#]*(?:career|carri[eè]re|jobs|recrut|rejoindre|join-us|joinus|emploi|talent|hiring)[^"#]*)"/gi) ?? []) {
    try {
      candidates.add(new URL(m[1], home!.url).href);
    } catch {
      // not a URL
    }
  }
  const pages = [home, ...(await Promise.all([...candidates].slice(0, 10).map(page)))].filter((p): p is { url: string; html: string } => Boolean(p));
  for (const p of pages) {
    const board = atsFromText(`${p.url} ${p.html}`);
    if (board) return { board, platform: null, careersUrl: p.url };
  }
  for (const p of pages) {
    const platform = PLATFORMS.find(([, re]) => re.test(`${p.url} ${p.html}`));
    if (platform) return { board: null, platform: platform[0], careersUrl: p.url };
  }
  return { board: null, platform: null, careersUrl: null };
}

export async function resolveCompany(db: SupabaseClient, input: string | Entry): Promise<Resolution> {
  const entry: Entry = typeof input === "string" ? (isUrl(input.trim()) ? { site: input.trim() } : { name: input.trim() }) : input;
  const site = entry.site?.trim() || null;
  const host = site ? new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, "") : null;
  let name = entry.name?.trim() || prettify(host!.split(".")[0]);

  if (entry.name) {
    const { data: known } = await db.from("companies").select("id, name, ats").eq("name_key", companyKey(entry.name)).maybeSingle();
    if (known?.ats) return { companyId: known.id, name: known.name, found: true, platform: null, offers: 0 };
  }

  // A board address given directly; otherwise the name and the site are explored side by side.
  let board = site ? atsFromText(site) : null;
  let platform: string | null = null;
  let careersUrl: string | null = null;
  if (!board) {
    const [byName, bySite] = await Promise.all([probeName(entry.name ?? host!.split(".")[0]), site ? exploreSite(site) : null]);
    board = bySite?.board ?? byName;
    platform = board ? null : (bySite?.platform ?? null);
    careersUrl = bySite?.careersUrl ?? null;
  }

  // Same board already in the directory: reuse it.
  if (board) {
    const { data: same } = await db.from("companies").select("id, name").eq("ats", board.ats).eq("ats_token", board.token).maybeSingle();
    if (same) {
      // "Backmarket" (from a URL slug) becomes "Back Market" once someone types the real name.
      const letters = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (entry.name && letters(entry.name) === letters(same.name) && entry.name !== same.name) await db.from("companies").update({ name: entry.name }).eq("id", same.id);
      return { companyId: same.id, name: entry.name ?? same.name, found: true, platform: null, offers: 0 };
    }
  }

  const key = companyKey(name);
  const { data: existing } = await db.from("companies").select("id, name").eq("name_key", key).maybeSingle();
  const fields = {
    ...(board ? { ats: board.ats, ats_token: board.token, discovered_via: "user" } : {}),
    ...(host ? { domain: host } : {}),
    careers_platform: platform,
    careers_url: careersUrl,
    ats_checked_at: new Date().toISOString(),
  };
  let companyId: string;
  if (existing) {
    await db.from("companies").update(fields).eq("id", existing.id);
    companyId = existing.id;
    name = existing.name;
  } else {
    const { data, error } = await db.from("companies").insert({ name, name_key: key, ...fields }).select("id").single();
    if (error) throw error;
    companyId = data.id;
  }

  // Read the career page now, so the company's offers are there right away.
  let offers = 0;
  if (board) {
    const keep = keepInScope(await scopeFromProfiles(db));
    offers = (await collectBoard(db, { id: companyId, name, domain: host, ats: board.ats, token: board.token }, keep)).seen;
  }
  return { companyId, name, found: Boolean(board), platform, offers };
}
