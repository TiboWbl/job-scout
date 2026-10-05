import { ContractType, JobOffer } from "@/lib/types";
import { colorForCompany, deriveCompanyBlurb, guessWorkMode, initialsForCompany, stripHtml, truncate } from "./normalize";

type Ats = "greenhouse" | "lever" | "ashby";

interface CompanyBoard {
  company: string;
  domain: string;
  ats: Ats;
  token: string;
}

// Curated, verified-live list of companies whose career page runs on a public ATS API (the
// same endpoint their own "jobs" widget calls — not HTML scraping). Add more via their
// Greenhouse/Lever/Ashby board token; all three 404 cleanly when a token is wrong, so a bad
// entry just contributes zero offers instead of breaking anything.
export const COMPANY_BOARDS: CompanyBoard[] = [
  { company: "Doctolib", domain: "doctolib.fr", ats: "greenhouse", token: "doctolib" },
  { company: "Algolia", domain: "algolia.com", ats: "greenhouse", token: "algolia" },
  { company: "Mirakl", domain: "mirakl.com", ats: "greenhouse", token: "mirakl" },
  { company: "Dataiku", domain: "dataiku.com", ats: "greenhouse", token: "dataiku" },
  { company: "Dashlane", domain: "dashlane.com", ats: "greenhouse", token: "dashlane" },
  { company: "Datadog", domain: "datadoghq.com", ats: "greenhouse", token: "datadog" },
  { company: "Platform.sh", domain: "platform.sh", ats: "greenhouse", token: "platformsh" },
  { company: "Malt", domain: "malt.fr", ats: "lever", token: "malt" },
  { company: "Qonto", domain: "qonto.com", ats: "lever", token: "qonto" },
  { company: "Contentsquare", domain: "contentsquare.com", ats: "lever", token: "contentsquare" },
  { company: "Swile", domain: "swile.co", ats: "lever", token: "swile" },
  { company: "BlaBlaCar", domain: "blablacar.com", ats: "lever", token: "blablacar" },
  { company: "Aircall", domain: "aircall.io", ats: "lever", token: "aircall" },
  { company: "Younited", domain: "younited.com", ats: "lever", token: "younited" },
  { company: "Veepee", domain: "veepee.com", ats: "lever", token: "veepee" },
  { company: "Heetch", domain: "heetch.com", ats: "lever", token: "heetch" },
  { company: "Agicap", domain: "agicap.com", ats: "lever", token: "agicap" },
  { company: "Pennylane", domain: "pennylane.com", ats: "ashby", token: "pennylane" },
  { company: "Spendesk", domain: "spendesk.com", ats: "ashby", token: "spendesk" },
  { company: "Ledger", domain: "ledger.com", ats: "ashby", token: "ledger" },
  { company: "Sorare", domain: "sorare.com", ats: "ashby", token: "sorare" },
  { company: "Voodoo", domain: "voodoo.io", ats: "ashby", token: "voodoo" },
];

// Keeps the boards that list hundreds of roles (e.g. a 150+ job Doctolib board) from pulling
// full descriptions for every single one — narrowed to the kind of role this app targets.
// Widen this list to broaden coverage to other profiles.
const TARGET_TITLE_KEYWORDS = /product (manager|owner|analyst|lead)|associate product|chef de produit|growth product/i;

const CONTRACT_KEYWORDS: [RegExp, ContractType][] = [
  [/stage|intern(ship)?/i, "Stage"],
  [/alternance|apprenti/i, "Alternance"],
  [/freelance|ind[ée]pendant|contractor/i, "Freelance"],
  [/\bCDD\b|fixed.term/i, "CDD"],
];

function guessContractType(title: string, extra?: string): ContractType {
  const text = `${title} ${extra ?? ""}`;
  for (const [re, type] of CONTRACT_KEYWORDS) {
    if (re.test(text)) return type;
  }
  return "CDI";
}

function baseOffer(board: CompanyBoard, idSuffix: string, title: string, description: string) {
  return {
    id: `board-${board.ats.slice(0, 2)}-${board.token}-${idSuffix}`,
    title,
    company: board.company,
    companyInitials: initialsForCompany(board.company),
    companyColor: colorForCompany(board.company),
    companyDomain: board.domain,
    companyDescription: deriveCompanyBlurb(description),
    workMode: guessWorkMode(description),
    contractType: guessContractType(title),
    domains: [],
    pitch: truncate(description, 160),
    fullDescription: description,
    tags: [] as string[],
    companySize: "Scale-up (50-250)" as const,
    source: "Page carrière" as const,
  };
}

interface GreenhouseJobSummary {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
}

interface GreenhouseJobDetail extends GreenhouseJobSummary {
  content?: string;
}

function buildGreenhouseOffer(board: CompanyBoard, job: GreenhouseJobDetail): JobOffer {
  const description = stripHtml(job.content ?? "");
  return {
    ...baseOffer(board, String(job.id), job.title, description),
    location: job.location?.name?.trim() || "France",
    sourceUrl: job.absolute_url,
    postedAt: job.updated_at ?? new Date().toISOString(),
  };
}

async function fetchGreenhouseBoard(board: CompanyBoard): Promise<JobOffer[]> {
  const listRes = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=false`, {
    next: { revalidate: 43200 },
  });
  if (!listRes.ok) return [];
  const list = (await listRes.json()) as { jobs?: GreenhouseJobSummary[] };
  const matches = (list.jobs ?? []).filter((job) => TARGET_TITLE_KEYWORDS.test(job.title));

  const details = await Promise.allSettled(
    matches.map(async (job) => {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs/${job.id}`, {
        next: { revalidate: 43200 },
      });
      if (!res.ok) return null;
      return (await res.json()) as GreenhouseJobDetail;
    }),
  );

  const offers: JobOffer[] = [];
  for (const result of details) {
    if (result.status === "fulfilled" && result.value) {
      offers.push(buildGreenhouseOffer(board, result.value));
    }
  }
  return offers;
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string };
  descriptionPlain?: string;
}

async function fetchLeverBoard(board: CompanyBoard): Promise<JobOffer[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${board.token}?mode=json`, {
    next: { revalidate: 43200 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as LeverPosting[];

  return data
    .filter((job) => TARGET_TITLE_KEYWORDS.test(job.text))
    .map((job) => {
      const description = stripHtml(job.descriptionPlain ?? "");
      return {
        ...baseOffer(board, job.id, job.text, description),
        location: job.categories?.location?.trim() || "France",
        contractType: guessContractType(job.text, job.categories?.commitment),
        tags: job.categories?.commitment ? [job.categories.commitment] : [],
        sourceUrl: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
      };
    });
}

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  descriptionPlain?: string;
  employmentType?: string;
}

async function fetchAshbyBoard(board: CompanyBoard): Promise<JobOffer[]> {
  // Ashby's board endpoint returns full descriptions for every posting in one response (no
  // lighter list variant), which can exceed Next's 2MB data-cache limit for a larger board —
  // harmless when it happens (that one response just isn't cached), so kept on the normal
  // revalidate path rather than forcing the whole /api/offers route to go dynamic.
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board.token}`, {
    next: { revalidate: 43200 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { jobs?: AshbyJob[] };

  return (data.jobs ?? [])
    .filter((job) => TARGET_TITLE_KEYWORDS.test(job.title))
    .map((job) => {
      const description = stripHtml(job.descriptionPlain ?? "");
      return {
        ...baseOffer(board, job.id, job.title, description),
        location: job.location?.trim() || "France",
        contractType: guessContractType(job.title, job.employmentType),
        sourceUrl: job.jobUrl || job.applyUrl || `https://jobs.ashbyhq.com/${board.token}`,
        postedAt: job.publishedAt ?? new Date().toISOString(),
      };
    });
}

export async function fetchCompanyBoardOffers(): Promise<JobOffer[]> {
  const fetchers: Record<Ats, (board: CompanyBoard) => Promise<JobOffer[]>> = {
    greenhouse: fetchGreenhouseBoard,
    lever: fetchLeverBoard,
    ashby: fetchAshbyBoard,
  };

  const results = await Promise.allSettled(COMPANY_BOARDS.map((board) => fetchers[board.ats](board)));

  const offers: JobOffer[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      offers.push(...result.value);
    } else {
      console.error("Company board fetch failed:", result.reason);
    }
  }
  return offers;
}
