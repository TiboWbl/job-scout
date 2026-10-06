import { z } from "zod";
import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { getLlm } from "@/lib/llm";
import { fetchBoard } from "./connectors/ats";
import { htmlToText } from "./normalize";
import { atsFromText } from "./resolve";

// Reads an offer found elsewhere (WTTJ, LinkedIn, a careers site) from its URL, or from pasted text
// when the page cannot be read. Public pages only, one request, as a browser would.

const SOURCE = "manual";

// Ids in posting URLs: long numbers (Greenhouse, SmartRecruiters) or UUIDs (Lever, Ashby).
const ids = (url: string): string[] => url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{5,}/gi) ?? [];

async function fromBoard(url: string): Promise<NormalizedOffer | null> {
  const board = atsFromText(url);
  if (!board) return null;
  const wanted = ids(url);
  if (wanted.length === 0) return null;
  const offers = await fetchBoard({ name: board.token, domain: null, ats: board.ats, token: board.token }).catch(() => []);
  return offers.find((o) => ids(o.sourceUrl).some((id) => wanted.includes(id))) ?? null;
}

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
function fromJsonLd(html: string, url: string): NormalizedOffer | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
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
      sourceKey: SOURCE,
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

const Extracted = z.object({
  titre: z.string().min(2),
  entreprise: z.string().nullish(),
  lieu: z.string().nullish(),
  contrat: z.string().nullish(),
});

const SYSTEM = `Tu lis le texte d'une offre d'emploi copié depuis une page web. Réponds uniquement avec un objet JSON :
{ "titre": intitulé du poste, "entreprise": nom de l'employeur ou null, "lieu": ville et pays ou null, "contrat": "CDI", "CDD", "Stage", "Alternance", "Freelance" ou null }
N'invente rien : null si l'information n'est pas dans le texte.`;

// Pasted text, or a page without structured data: the model reads title, company and place.
export async function fromText(text: string, url: string | null): Promise<NormalizedOffer | null> {
  const clean = text.replace(/\s+\n/g, "\n").trim().slice(0, 15_000);
  if (clean.length < 80) return null;
  const parsed = Extracted.safeParse(await getLlm().json({ system: SYSTEM, user: clean.slice(0, 8000), tier: "fast" }));
  if (!parsed.success) return null;
  const e = parsed.data;
  const loc = parseLocation(e.lieu ?? "", `${e.titre}\n${clean.slice(0, 600)}`);
  return {
    sourceKey: SOURCE,
    sourceUrl: url ?? "",
    company: { name: e.entreprise?.trim() || "Entreprise non communiquée" },
    title: e.titre.trim(),
    locationRaw: e.lieu ?? null,
    ...loc,
    contract: detectContract(e.titre, e.contrat?.toLowerCase() ?? null, clean),
    experienceMinYears: detectExperienceYears(clean),
    description: clean,
    applyUrl: url ?? "",
    publishedAt: null,
  };
}

// null means the page could not be read (login wall, bot protection): ask for the text instead.
export async function fromUrl(url: string): Promise<NormalizedOffer | null> {
  const viaBoard = await fromBoard(url);
  if (viaBoard) return { ...viaBoard, sourceKey: viaBoard.sourceKey };
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Scout job aggregator)", Accept: "text/html", "Accept-Language": "fr-FR,fr;q=0.9" },
  }).catch(() => null);
  if (!res?.ok) return null;
  const html = await res.text();
  const structured = fromJsonLd(html, url);
  if (structured) return structured;
  const body = htmlToText(html.replace(/<(script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, " "));
  // Login walls and bot checks leave little text: better to ask for the posting itself.
  if (body.length < 400 || /sign in|se connecter|captcha|verify you are human/i.test(body.slice(0, 600))) return null;
  return fromText(body, url);
}
