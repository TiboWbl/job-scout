export type ContractType = "CDI" | "CDD" | "Stage" | "Alternance" | "Freelance";

export type WorkMode = "Remote" | "Hybride" | "Présentiel";

export type CompanySize =
  | "Startup (<50)"
  | "Scale-up (50-250)"
  | "PME/ETI (250-5000)"
  | "Grand groupe (5000+)"
  | "Non précisé";

// Only real, legally-sourced offers: official/partner APIs and public ATS job-board APIs
// (the same ones company career pages embed), never scraped platforms.
export type Source = "France Travail" | "Adzuna" | "Page carrière";

export type PriorityKey =
  | "salaire"
  | "localisation"
  | "contrat"
  | "domaine"
  | "mission"
  | "taille";

export type OfferStatus = "active" | "expired" | "unknown";

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  companyInitials: string;
  companyColor: string;
  companyDomain?: string; // used to resolve a real logo; falls back to initials when absent or unresolvable
  companyDescription?: string;
  location: string;
  workMode: WorkMode;
  contractType: ContractType;
  domains: string[];
  salaryMin?: number;
  salaryMax?: number;
  pitch: string;
  fullDescription: string;
  tags: string[];
  companySize: CompanySize;
  source: Source;
  sourceUrl: string;
  postedAt: string; // ISO date
  status?: OfferStatus;
  statusCheckedAt?: string; // ISO date, set only once a saved offer has been rechecked
}

export type ApplicationStage = "interesse" | "envoyee" | "entretien" | "offre" | "refuse";

export interface ApplicationEntry {
  id: string;
  offerId?: string;
  title: string;
  company: string;
  sourceUrl?: string;
  stage: ApplicationStage;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchCriteria {
  jobTitles: string[];
  missionKeywords: string[];
  domains: string[];
  locations: string[];
  remoteOnly: boolean;
  workModes: WorkMode[];
  contractTypes: ContractType[];
  salaryMin: number;
  companySizes: CompanySize[];
  sources: Source[];
  excludeKeywords: string[];
  priorities: PriorityKey[];
}

export const DEFAULT_CRITERIA: SearchCriteria = {
  jobTitles: [],
  missionKeywords: [],
  domains: [],
  locations: [],
  remoteOnly: false,
  workModes: [],
  contractTypes: [],
  salaryMin: 0,
  companySizes: [],
  sources: ["France Travail", "Adzuna", "Page carrière"],
  excludeKeywords: [],
  priorities: [],
};
