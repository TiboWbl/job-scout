import type { NormalizedOffer } from "@/lib/domain/offer";
import { fromJsonLd } from "../jsonld";
import type { BoardRef, Keep, Wanted } from "./ats-more";

// A company's own career site, without a known ATS: its job pages carry the schema.org JobPosting
// that search engines read. The board token is the address of the page listing the offers. Job links
// come from that page, or from the site map when the list is drawn in the browser.

const TIMEOUT_MS = 12_000;
const MAX_JOBS = 120;
const PARALLEL = 6;
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; Scout job aggregator)", Accept: "text/html,application/xml", "Accept-Language": "fr-FR,fr;q=0.9" };
// Paths that look like a single job page, not a list or a filter.
const JOB_PATH = /\/(jobs?|offres?(-d-emploi)?|annonces?|emplois?|postes?|careers?|carrieres?|job-offers?|positions?|vacanc(y|ies)|opportunit(y|ies)|recrutement)\/[^?#]*[a-z0-9-]{6,}/i;

async function text(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: HEADERS, redirect: "follow" }).catch(() => null);
  return res?.ok ? res.text().catch(() => null) : null;
}

// Job links of a listing page, with their visible text (usually the title).
export function jobLinks(html: string, pageUrl: string): { url: string; label: string }[] {
  const base = new URL(pageUrl);
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1].replace(/&amp;/g, "&"), base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname || !JOB_PATH.test(url.pathname) || url.pathname.replace(/\/$/, "") === base.pathname.replace(/\/$/, "")) continue;
    // On a shared career site, only this company's offers.
    const company = /^\/companies\/[^/]+/.exec(base.pathname)?.[0];
    if (company && !url.pathname.startsWith(company)) continue;
    url.search = "";
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!out.has(url.href) || label.length > (out.get(url.href)?.length ?? 0)) out.set(url.href, label);
  }
  return [...out].map(([url, label]) => ({ url, label }));
}

async function fromSitemap(pageUrl: string): Promise<string[]> {
  const origin = new URL(pageUrl).origin;
  const urls: string[] = [];
  const queue = [`${origin}/sitemap.xml`];
  for (let i = 0; i < queue.length && i < 6; i++) {
    const xml = await text(queue[i]);
    if (!xml) continue;
    for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (/\.xml(\.gz)?$/i.test(loc)) {
        if (/job|offre|emploi|career|carriere|poste|vacanc/i.test(loc)) queue.push(loc);
      } else if (JOB_PATH.test(new URL(loc, origin).pathname)) urls.push(loc);
    }
  }
  return urls;
}

export async function site(board: BoardRef, keep?: Keep, wanted?: Wanted): Promise<NormalizedOffer[]> {
  const listing = await text(board.token);
  if (listing === null) throw new Error("career page unreachable");
  let links = jobLinks(listing, board.token);
  if (links.length === 0) links = (await fromSitemap(board.token)).map((url) => ({ url, label: "" }));
  // Titles visible on the list spare the requests no search could use.
  const toRead = links.filter((l) => !wanted || !l.label || l.label.length > 120 || wanted(l.label)).slice(0, MAX_JOBS);
  const out: NormalizedOffer[] = [];
  for (let i = 0; i < toRead.length; i += PARALLEL) {
    const pages = await Promise.all(toRead.slice(i, i + PARALLEL).map(async (l) => ({ url: l.url, html: await text(l.url) })));
    for (const p of pages) {
      const offer = p.html ? fromJsonLd(p.html, p.url) : null;
      if (!offer || (keep && !keep(offer.places, offer.remote))) continue;
      out.push({ ...offer, sourceKey: `site:${board.token}`, company: { name: board.name, domain: board.domain ?? undefined, ats: "site", atsToken: board.token } });
    }
  }
  return out;
}
