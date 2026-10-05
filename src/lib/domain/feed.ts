import type { Level, Place, Remote } from "./offer";

export type FeedOffer = {
  id: string;
  title: string;
  location_raw: string | null;
  places: Place[];
  remote: Remote;
  contract: string;
  experience_min_years: number | null;
  apply_url: string;
  published_at: string | null;
  first_seen_at: string;
  company: { name: string; domain: string | null; accent_color: string | null };
};

export type FeedItem = {
  offer: FeedOffer;
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
  scored_by: string;
  saved: boolean;
  dismissed: boolean;
};

export const LEVEL_ORDER: Record<Level, number> = { coeur: 0, solide: 1, tremplin: 2, ecartee: 3 };

// "Seulement si exceptionnelle": an out-of-zone offer only surfaces when everything else is excellent.
export function isExceptional(item: Pick<FeedItem, "level" | "score_interet" | "score_chances">) {
  return item.level === "coeur" && (item.score_interet ?? 0) >= 85 && (item.score_chances ?? 0) >= 70;
}
