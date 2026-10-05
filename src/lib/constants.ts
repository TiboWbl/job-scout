import { ApplicationStage, CompanySize, ContractType, PriorityKey, Source, WorkMode } from "./types";

export const JOB_TITLE_SUGGESTIONS = [
  "Product Manager",
  "Product Owner",
  "Associate Product Manager",
  "PM Junior",
  "Growth Product Manager",
  "Chef de produit digital",
  "Product Analyst",
];

export const MISSION_KEYWORD_SUGGESTIONS = [
  "Discovery utilisateur",
  "Roadmap produit",
  "Spécifications techniques",
  "Pilotage de squad",
  "Growth & expérimentation",
  "Data & KPIs",
  "Lancement produit",
  "Relation client B2B",
];

export const DOMAIN_SUGGESTIONS = [
  "SaaS B2B",
  "SportsTech",
  "Fintech",
  "E-commerce",
  "Marketplace",
  "IA / Tech",
  "Mobilité",
  "Santé",
  "EdTech",
  "Climat / GreenTech",
];

export const LOCATION_SUGGESTIONS = ["Paris", "Lyon", "Bordeaux", "Nantes", "Lille", "Remote France"];

export const WORK_MODES: WorkMode[] = ["Remote", "Hybride", "Présentiel"];

export const CONTRACT_TYPES: ContractType[] = ["CDI", "CDD", "Stage", "Alternance", "Freelance"];

export const COMPANY_SIZES: CompanySize[] = [
  "Startup (<50)",
  "Scale-up (50-250)",
  "PME/ETI (250-5000)",
  "Grand groupe (5000+)",
];

export const SOURCES: Source[] = ["France Travail", "Adzuna", "Page carrière"];

export const SOURCE_COLORS: Record<Source, string> = {
  "France Travail": "#0f5fd1",
  Adzuna: "#1aad8e",
  "Page carrière": "#7c3aed",
};

export const SOURCE_DESCRIPTIONS: Record<Source, string> = {
  "France Travail": "API officielle du service public de l'emploi.",
  Adzuna: "Agrégateur légal avec API publique.",
  "Page carrière": "API publique des pages carrière d'entreprises (Greenhouse, Lever…), les offres publiées directement par les boîtes, sans scraping.",
};

export const PRIORITY_OPTIONS: { key: PriorityKey; label: string }[] = [
  { key: "mission", label: "Mission & impact" },
  { key: "domaine", label: "Domaine d'activité" },
  { key: "salaire", label: "Salaire" },
  { key: "localisation", label: "Localisation & télétravail" },
  { key: "contrat", label: "Type de contrat" },
  { key: "taille", label: "Taille d'entreprise" },
];

export const MAX_PRIORITIES = 3;

export const APPLICATION_STAGES: { key: ApplicationStage; label: string }[] = [
  { key: "interesse", label: "Intéressé" },
  { key: "envoyee", label: "Candidature envoyée" },
  { key: "entretien", label: "En entretien" },
  { key: "offre", label: "Offre reçue" },
  { key: "refuse", label: "Refusé" },
];
