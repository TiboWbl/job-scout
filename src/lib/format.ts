const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// "il y a 3 jours", to follow "Publiée".
export function freshness(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = now - new Date(iso).getTime();
  if (diff < HOUR) return "à l'instant";
  if (diff < DAY) return `il y a ${Math.floor(diff / HOUR)} h`;
  if (diff < 2 * DAY) return "hier";
  if (diff < 31 * DAY) return `il y a ${Math.floor(diff / DAY)} jours`;
  const months = Math.floor(diff / (30 * DAY));
  return months <= 1 ? "il y a 1 mois" : `il y a ${months} mois`;
}

// Career pages sometimes keep old postings online: beyond this age they are hidden by default.
export const STALE_DAYS = 60;
export function isStale(iso: string | null | undefined, now = Date.now()) {
  return Boolean(iso) && now - new Date(iso!).getTime() > STALE_DAYS * DAY;
}

// "Postuler tôt compte": offers under 48 h get a soft highlight, never an alarm.
export function isFresh(iso: string | null | undefined, now = Date.now()) {
  return Boolean(iso) && now - new Date(iso!).getTime() < 2 * DAY;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function placeLabel(places: { city?: string; region?: string; country?: string }[], raw: string | null): string {
  const cities = places.map((p) => p.city).filter(Boolean);
  if (cities.length) return cities.slice(0, 2).join(", ") + (cities.length > 2 ? ` +${cities.length - 2}` : "");
  return raw?.split(/[;|]/)[0]?.trim() || "Lieu non précisé";
}
