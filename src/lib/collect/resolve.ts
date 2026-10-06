import type { SupabaseClient } from "@supabase/supabase-js";
import { ATS_LIST, fetchBoard, type Ats } from "./connectors/ats";
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

export type Resolution = { companyId: string; name: string; found: boolean; offers: number };

const isUrl = (s: string) => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+\/?/.test(s);
const prettify = (token: string) => token.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function pageHtml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Scout job aggregator" } }).catch(() => null);
  return res?.ok ? await res.text() : "";
}

// A guessed slug counts only if the board answers with at least one posting: empty boards prove nothing.
async function probeName(name: string): Promise<{ ats: Ats; token: string; company: string } | null> {
  const guesses = slugGuesses(name).flatMap((token) => ATS_LIST.map((ats) => ({ ats, token })));
  const hits = await Promise.all(
    guesses.map(async (g) => {
      const offers = await fetchBoard({ name, domain: null, ats: g.ats, token: g.token }).catch(() => []);
      return offers.length > 0 ? { ...g, company: offers[0].company.name } : null;
    }),
  );
  return hits.find(Boolean) ?? null;
}

export async function resolveCompany(db: SupabaseClient, input: string): Promise<Resolution> {
  const raw = input.trim();
  let name = raw;
  let domain: string | null = null;
  let board: { ats: Ats; token: string } | null = null;

  if (isUrl(raw)) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    board = atsFromText(url);
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!board) {
      // A company's own careers page usually embeds or links its ATS board.
      board = atsFromText(await pageHtml(url));
      domain = host;
    }
    name = board ? prettify(board.token) : prettify(host.split(".")[0]);
  } else {
    const { data: known } = await db.from("companies").select("id, name, ats").eq("name_key", companyKey(raw)).maybeSingle();
    if (known?.ats) return { companyId: known.id, name: known.name, found: true, offers: 0 };
    const probed = await probeName(raw);
    if (probed) board = { ats: probed.ats, token: probed.token };
  }

  // Same board already in the directory: reuse it.
  if (board) {
    const { data: same } = await db.from("companies").select("id, name").eq("ats", board.ats).eq("ats_token", board.token).maybeSingle();
    if (same) {
      // "Backmarket" (from a URL slug) becomes "Back Market" once someone types the real name.
      const letters = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!isUrl(raw) && letters(raw) === letters(same.name) && raw !== same.name) await db.from("companies").update({ name: raw }).eq("id", same.id);
      return { companyId: same.id, name: isUrl(raw) ? same.name : raw, found: true, offers: 0 };
    }
  }

  const key = companyKey(name);
  const { data: existing } = await db.from("companies").select("id, name").eq("name_key", key).maybeSingle();
  const fields = { ...(board ? { ats: board.ats, ats_token: board.token, discovered_via: "user" } : {}), ...(domain ? { domain } : {}), ats_checked_at: new Date().toISOString() };
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
    offers = (await collectBoard(db, { id: companyId, name, domain, ats: board.ats, token: board.token }, keep)).seen;
  }
  return { companyId, name, found: Boolean(board), offers };
}
