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
