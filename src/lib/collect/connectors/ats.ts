import { parseLocation } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears } from "@/lib/domain/signals";
import type { NormalizedOffer } from "@/lib/domain/offer";
import { htmlToText } from "../normalize";
import { digitalrecruiters, personio, recruitee, smartrecruiters, teamtailor, workable, type Keep, type Wanted } from "./ats-more";

export const ATS_LIST = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee", "teamtailor", "personio", "digitalrecruiters"] as const;
export type Ats = (typeof ATS_LIST)[number];
export type Board = { name: string; domain: string | null; ats: Ats; token: string };

// Initial stock of companies whose career pages run on a public ATS API (the endpoint their own
// jobs widget calls, not HTML scraping). The directory grows from here; nothing in the product
// depends on these companies or their sector.
export const SEED_BOARDS: Board[] = [
  { name: "Doctolib", domain: "doctolib.fr", ats: "greenhouse", token: "doctolib" },
  { name: "Algolia", domain: "algolia.com", ats: "greenhouse", token: "algolia" },
  { name: "Mirakl", domain: "mirakl.com", ats: "greenhouse", token: "mirakl" },
  { name: "Dataiku", domain: "dataiku.com", ats: "greenhouse", token: "dataiku" },
  { name: "Dashlane", domain: "dashlane.com", ats: "greenhouse", token: "dashlane" },
  { name: "Datadog", domain: "datadoghq.com", ats: "greenhouse", token: "datadog" },
  { name: "Platform.sh", domain: "platform.sh", ats: "greenhouse", token: "platformsh" },
  { name: "Malt", domain: "malt.fr", ats: "lever", token: "malt" },
  { name: "Qonto", domain: "qonto.com", ats: "lever", token: "qonto" },
  { name: "Contentsquare", domain: "contentsquare.com", ats: "lever", token: "contentsquare" },
  { name: "Swile", domain: "swile.co", ats: "lever", token: "swile" },
  { name: "BlaBlaCar", domain: "blablacar.com", ats: "lever", token: "blablacar" },
  { name: "Aircall", domain: "aircall.io", ats: "lever", token: "aircall" },
  { name: "Younited", domain: "younited.com", ats: "lever", token: "younited" },
  { name: "Veepee", domain: "veepee.com", ats: "lever", token: "veepee" },
  { name: "Heetch", domain: "heetch.com", ats: "lever", token: "heetch" },
  { name: "Agicap", domain: "agicap.com", ats: "lever", token: "agicap" },
  { name: "Pennylane", domain: "pennylane.com", ats: "ashby", token: "pennylane" },
  { name: "Spendesk", domain: "spendesk.com", ats: "ashby", token: "spendesk" },
  { name: "Ledger", domain: "ledger.com", ats: "ashby", token: "ledger" },
  { name: "Sorare", domain: "sorare.com", ats: "ashby", token: "sorare" },
  { name: "Voodoo", domain: "voodoo.io", ats: "ashby", token: "voodoo" },
];

const TIMEOUT_MS = 30_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Scout job aggregator" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function base(board: Board) {
  return {
    sourceKey: `${board.ats}:${board.token}`,
    company: { name: board.name, domain: board.domain ?? undefined, ats: board.ats, atsToken: board.token },
  };
}

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  first_published?: string;
  updated_at?: string;
  location?: { name?: string };
  metadata?: { name: string; value: unknown }[] | null;
};

async function greenhouse(board: Board): Promise<NormalizedOffer[]> {
  const data = await getJson<{ jobs: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`);
  return data.jobs.map((job) => {
    const description = htmlToText(job.content ?? "");
    const employment = job.metadata?.find((m) => /employment|contract|type/i.test(m.name))?.value;
    const loc = parseLocation(job.location?.name, `${job.title}\n${description.slice(0, 600)}`);
    return {
      ...base(board),
      sourceUrl: job.absolute_url,
      title: job.title.trim(),
      locationRaw: job.location?.name ?? null,
      ...loc,
      contract: detectContract(job.title, typeof employment === "string" ? employment : null, description),
      experienceMinYears: detectExperienceYears(description),
      description,
      applyUrl: job.absolute_url,
      publishedAt: job.first_published ?? job.updated_at ?? null,
    };
  });
}

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  categories?: { location?: string; commitment?: string; allLocations?: string[] };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
};

async function lever(board: Board): Promise<NormalizedOffer[]> {
  const data = await getJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${board.token}?mode=json`);
  return data.map((job) => {
    // Requirements often live in `lists`, not in the main description.
    const description = [
      job.descriptionPlain?.trim() ?? "",
      ...(job.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`),
      job.additionalPlain?.trim() ?? "",
    ].filter(Boolean).join("\n\n");
    const locationRaw = job.categories?.allLocations?.join("; ") || job.categories?.location || null;
    const loc = parseLocation(locationRaw, `${job.workplaceType ?? ""}\n${job.text}`);
    if (job.workplaceType === "remote") loc.remote = "remote";
    else if (job.workplaceType === "hybrid") loc.remote = "hybrid";
    else if (job.workplaceType === "onsite" && loc.remote === "unknown") loc.remote = "onsite";
    return {
      ...base(board),
      sourceUrl: job.hostedUrl,
      title: job.text.trim(),
      locationRaw,
      ...loc,
      contract: detectContract(job.text, job.categories?.commitment, description),
      experienceMinYears: detectExperienceYears(description),
      description,
      applyUrl: job.hostedUrl,
      publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    };
  });
}

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  workplaceType?: string;
  isRemote?: boolean;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  isListed?: boolean;
};

const ASHBY_EMPLOYMENT: Record<string, string> = { Intern: "internship", Contract: "contractor", Temporary: "fixed-term", FullTime: "permanent", PartTime: "" };

async function ashby(board: Board): Promise<NormalizedOffer[]> {
  const data = await getJson<{ jobs: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${board.token}`);
  return data.jobs
    .filter((job) => job.isListed !== false)
    .map((job) => {
      const description = job.descriptionHtml ? htmlToText(job.descriptionHtml) : (job.descriptionPlain ?? "");
      const locationRaw = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join("; ") || null;
      const loc = parseLocation(locationRaw, `${job.workplaceType ?? ""}\n${job.title}`);
      if (job.workplaceType === "Remote") loc.remote = "remote";
      else if (job.workplaceType === "Hybrid") loc.remote = "hybrid";
      else if (job.workplaceType === "OnSite" && loc.remote === "unknown") loc.remote = "onsite";
      const url = job.jobUrl ?? job.applyUrl ?? `https://jobs.ashbyhq.com/${board.token}`;
      return {
        ...base(board),
        sourceUrl: url,
        title: job.title.trim(),
        locationRaw,
        ...loc,
        contract: detectContract(job.title, ASHBY_EMPLOYMENT[job.employmentType ?? ""] ?? null, description),
        experienceMinYears: detectExperienceYears(description),
        description,
        applyUrl: url,
        publishedAt: job.publishedAt ?? null,
      };
    });
}

const FETCHERS: Record<Ats, (b: Board, keep?: Keep, wanted?: Wanted) => Promise<NormalizedOffer[]>> = { greenhouse, lever, ashby, smartrecruiters, workable, recruitee, teamtailor, personio, digitalrecruiters };

export function fetchBoard(board: Board, keep?: Keep, wanted?: Wanted) {
  return FETCHERS[board.ats](board, keep, wanted);
}
