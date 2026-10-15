import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { htmlToText } from "./normalize";

type JsonLd = Record<string, unknown>;
function findJobPosting(node: unknown): JsonLd | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map(findJobPosting).find(Boolean) ?? null;
  const obj = node as JsonLd;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  return findJobPosting(obj["@graph"]);
}

const str = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" && "name" in v ? str((v as JsonLd).name) : "");

// Most job sites publish the structured schema.org JobPosting that search engines read.
export function fromJsonLd(html: string, url: string): NormalizedOffer | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      // Some sites leave raw line breaks inside strings, which strict JSON refuses.
      parsed = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      continue;
    }
    const job = findJobPosting(parsed);
    if (!job) continue;
    const title = str(job.title).trim();
    if (!title) continue;
    const locs = (Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation]).filter(Boolean) as JsonLd[];
    const raw = locs
      .map((l) => {
        const a = (l.address ?? {}) as JsonLd;
        return [str(a.addressLocality), str(a.addressRegion), str(a.addressCountry)].filter(Boolean).join(", ");
      })
      .filter(Boolean)
      .join("; ");
    const description = htmlToText(str(job.description));
    const loc = parseLocation(raw, `${title}\n${str(job.jobLocationType)}`);
    if (/telecommute/i.test(str(job.jobLocationType))) loc.remote = "remote";
    const employment = Array.isArray(job.employmentType) ? job.employmentType.join(" ") : str(job.employmentType);
    return {
      sourceKey: "manual",
      sourceUrl: url,
      company: { name: str(job.hiringOrganization).trim() || "Entreprise non communiquée" },
      title,
      locationRaw: raw || null,
      ...loc,
      contract: detectContract(title, employment.replace(/_/g, "-").toLowerCase(), description),
      experienceMinYears: detectExperienceYears(description),
      description,
      applyUrl: url,
      publishedAt: str(job.datePosted) || null,
    };
  }
  return null;
}

const decode = (s: string) => htmlToText(s).replace(/\s+/g, " ").trim();
// Not a job: an open application, a newsletter, a list of offers.
const NOT_A_JOB = /candidature spontan|spontaneous application|open application|newsletter|toutes nos offres|all jobs/i;

// A job page without JobPosting (many small companies' own sites): its title from <h1> (or the page
// title), its text from <main>/<article> (or the body without header and footer), its place read in
// the first lines. Only a page that reads like a posting (a title and enough text) counts.
export function fromHtmlPage(html: string, url: string): NormalizedOffer | null {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const og = /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i.exec(html)?.[1];
  const title = decode(h1 ?? og ?? /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s*[|·–-]\s*[^|·–-]{2,40}$/, "").slice(0, 140);
  if (!title || title.length < 4 || NOT_A_JOB.test(title)) return null;
  const clean = html.replace(/<(script|style|noscript|svg|header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ");
  const body = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(clean)?.[1] ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(clean)?.[1] ?? /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(clean)?.[1] ?? clean;
  const description = htmlToText(body).trim();
  if (description.length < 400 || NOT_A_JOB.test(description.slice(0, 200))) return null;
  const head = description.split("\n").slice(0, 30).join(" ");
  const loc = parseLocation(head, title);
  if (loc.places.length === 0) loc.places = [{ country: "FR" }];
  return {
    sourceKey: "manual",
    sourceUrl: url,
    company: { name: "Entreprise non communiquée" },
    title,
    locationRaw: loc.places.map((p) => p.city).filter(Boolean).join(", ") || null,
    ...loc,
    contract: detectContract(title, null, description),
    experienceMinYears: detectExperienceYears(description),
    description,
    applyUrl: url,
    publishedAt: null,
  };
}
