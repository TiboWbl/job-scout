import type { Contract } from "./criteria";

export type Place = { city?: string; region?: string; country?: string };
export type Remote = "onsite" | "hybrid" | "remote" | "unknown";
export type Level = "coeur" | "solide" | "tremplin" | "ecartee";

export const LEVEL_LABELS: Record<Level, string> = {
  coeur: "Coup de cœur",
  solide: "Solide",
  tremplin: "Tremplin",
  ecartee: "Écartée",
};

export const REMOTE_LABELS: Record<Remote, string> = {
  onsite: "Sur site",
  hybrid: "Hybride",
  remote: "Télétravail complet",
  unknown: "Télétravail non précisé",
};

// What every connector produces, whatever its source.
export type NormalizedOffer = {
  sourceKey: string; // e.g. "greenhouse:doctolib", "france-travail"
  sourceUrl: string;
  company: { name: string; domain?: string; ats?: string; atsToken?: string };
  title: string;
  locationRaw: string | null;
  places: Place[];
  remote: Remote;
  remoteScope: string[];
  contract: Contract | "unknown";
  experienceMinYears: number | null;
  description: string;
  applyUrl: string;
  publishedAt: string | null;
  // A photo published with the offer itself, when the source has one.
  imageUrl?: string;
};

// An offer as read back from the database, with its company.
export type StoredOffer = {
  id: string;
  title: string;
  location_raw: string | null;
  places: Place[];
  remote: Remote;
  remote_scope: string[];
  contract: Contract | "unknown";
  experience_min_years: number | null;
  description: string | null;
  apply_url: string;
  published_at: string | null;
  first_seen_at: string;
  archived_at: string | null;
  company: { id: string; name: string; domain: string | null; accent_color: string | null };
};

export type Score = {
  offer_id: string;
  level: Level;
  out_of_zone: boolean;
  excluded_reason: string | null;
  score_interet: number | null;
  score_chances: number | null;
  score_tremplin: number | null;
  why: string | null;
  strengths: string[];
  watch: string[];
  cv_levers: string[];
};
