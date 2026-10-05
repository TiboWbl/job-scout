// Each pair is a {from, to} gradient — used for the monogram shown while a real logo loads
// or when none can be found, so even the fallback looks like a deliberate brand mark.
const PALETTE: [string, string][] = [
  ["#6153f0", "#3730a3"],
  ["#2563eb", "#0c4a9e"],
  ["#0d9488", "#0f5e52"],
  ["#d97706", "#92400e"],
  ["#ea580c", "#9a3412"],
  ["#0891b2", "#155e75"],
  ["#9333ea", "#581c87"],
  ["#db2777", "#831843"],
  ["#16a34a", "#14532d"],
  ["#475569", "#1e293b"],
];

export function colorForCompany(name: string): string {
  return gradientForCompany(name)[0];
}

export function gradientForCompany(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initialsForCompany(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

function decodeEntitiesOnce(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&eacute;|&#233;/g, "é")
    .replace(/&egrave;|&#232;/g, "è")
    .replace(/&agrave;|&#224;/g, "à")
    .replace(/&ccedil;|&#231;/g, "ç")
    .replace(/&ocirc;|&#244;/g, "ô")
    .replace(/&amp;/g, "&");
}

export function stripHtml(html: string): string {
  // Entities must be decoded before tag-stripping: some sources (Greenhouse among them) return
  // already-escaped markup (literal "&lt;h2&gt;"), occasionally double-escaped — running the
  // pass twice resolves both without needing to detect which case we're in.
  const decoded = decodeEntitiesOnce(decodeEntitiesOnce(html));

  return decoded
    .replace(/<\/(p|li|div|br|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function guessWorkMode(description: string): "Remote" | "Hybride" | "Présentiel" {
  const text = description.toLowerCase();
  if (/t[ée]l[ée]travail (int[ée]gral|complet|100\s?%)|full remote|100% remote/.test(text)) return "Remote";
  if (/t[ée]l[ée]travail|remote|hybride/.test(text)) return "Hybride";
  return "Présentiel";
}

// company.com is a decent first guess for a lot of companies and costs nothing to try — the
// logo component falls back to initials on load failure, so a wrong guess is invisible to the user.
export function guessDomain(company: string): string {
  const slug = company
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${slug}.com`;
}

const ABOUT_MARKERS = /^(qui sommes[ -]nous ?\??|notre entreprise|[àa] propos( de nous)?|pr[ée]sentation( de l'entreprise)?|about us|who we are|l'entreprise)\s*:?\s*$/i;
const SECTION_MARKERS = /^(vos? missions?|le poste|profil recherch[ée]|ce que (vous|tu) (ferez|fera)|responsabilit[ée]s|qualifications?|exigences|requirements|what you'll do|about the role)\b/i;

// Only returns something when an explicit "about the company" marker is found — a confident
// signal beats a guessed first paragraph that might actually be the job pitch itself.
export function deriveCompanyBlurb(description: string): string | undefined {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const startIdx = lines.findIndex((l) => ABOUT_MARKERS.test(l));
  if (startIdx === -1) return undefined;

  const collected: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (SECTION_MARKERS.test(lines[i]) || ABOUT_MARKERS.test(lines[i])) break;
    collected.push(lines[i]);
    if (collected.join(" ").length > 400) break;
  }

  const text = collected.join(" ").trim();
  return text.length > 30 ? truncate(text, 400) : undefined;
}
