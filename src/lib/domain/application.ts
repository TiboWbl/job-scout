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
  created_at: string;
  updated_at: string;
};
