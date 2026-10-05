import { JobOffer } from "./types";

export function formatSalary(offer: JobOffer): string | null {
  const { salaryMin, salaryMax, contractType } = offer;
  if (salaryMin === undefined && salaryMax === undefined) return null;
  const unit = contractType === "Freelance" ? "€/j" : "k€/an";
  if (salaryMin !== undefined && salaryMax !== undefined && salaryMin !== salaryMax) {
    return `${salaryMin}–${salaryMax} ${unit}`;
  }
  return `${salaryMax ?? salaryMin} ${unit}`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  const weeks = Math.round(diffDays / 7);
  if (weeks === 1) return "Il y a 1 semaine";
  return `Il y a ${weeks} semaines`;
}

export function isNewOffer(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= 1;
}
