export const STAGES = ["a_postuler", "postule", "entretien", "offre", "refuse", "archive"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  a_postuler: "À postuler",
  postule: "Postulé",
  entretien: "Entretien",
  offre: "Offre",
  refuse: "Refusé",
  archive: "Archivé",
};

export type Application = {
  id: string;
  offer_id: string | null;
  title: string;
  company: string;
  url: string | null;
  stage: Stage;
  applied_at: string | null;
  notes: string;
  contact: string;
  interview_at: string | null;
  followed_up_at: string | null;
  origin: "scout" | "added";
  created_at: string;
  updated_at: string;
};

export const FOLLOW_UP_DAYS = 7;

// A follow-up is suggested a week after applying, then a week after the last one; never pushy.
export function followUpDue(a: Pick<Application, "stage" | "applied_at" | "followed_up_at">, now = Date.now()): boolean {
  if (a.stage !== "postule") return false;
  const since = a.followed_up_at ?? a.applied_at;
  return Boolean(since) && now - new Date(since!).getTime() >= FOLLOW_UP_DAYS * 86_400_000;
}

export function isUpcoming(iso: string | null, now = Date.now()): boolean {
  return Boolean(iso) && new Date(iso!).getTime() > now;
}
