const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function freshness(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = now - new Date(iso).getTime();
  if (diff < HOUR) return "À l'instant";
  if (diff < DAY) return `Il y a ${Math.floor(diff / HOUR)} h`;
  if (diff < 2 * DAY) return "Hier";
  if (diff < 7 * DAY) return `Il y a ${Math.floor(diff / DAY)} jours`;
  const weeks = Math.floor(diff / (7 * DAY));
  if (weeks < 5) return weeks === 1 ? "Il y a 1 semaine" : `Il y a ${weeks} semaines`;
  const months = Math.floor(diff / (30 * DAY));
  return months <= 1 ? "Il y a 1 mois" : `Il y a ${months} mois`;
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
