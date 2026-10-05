import { Criteria, CvSummary, emptyCriteria, type ZonePlace } from "@/lib/domain/criteria";
import { parseLocation, REGION_LABELS } from "@/lib/domain/geo";
import { getLlm } from "@/lib/llm";

const COUNTRY_NAMES: Record<string, string> = { FR: "France", US: "États-Unis", GB: "Royaume-Uni", DE: "Allemagne", ES: "Espagne", PT: "Portugal", BE: "Belgique", CH: "Suisse", NL: "Pays-Bas", CA: "Canada", IT: "Italie", IE: "Irlande", LU: "Luxembourg" };

const CRITERIA_SYSTEM = `Tu aides une personne à formaliser sa recherche d'emploi. Tu reçois sa description en langage naturel et, parfois, un résumé de son CV (sans données personnelles).
Réponds uniquement avec un objet JSON de cette forme :
{
  "targetRoles": [métiers visés, 1 à 3, intitulés courts],
  "titleVariants": [8 à 20 intitulés équivalents en français ET en anglais, y compris niveaux d'entrée (junior, associate), sans intitulés seniors],
  "bridgeRoles": [métiers passerelles crédibles vers le métier visé, 0 à 6],
  "sectorsPriority": [secteurs prioritaires mentionnés ou évidents],
  "sectorsOk": [secteurs acceptables],
  "sectorsAvoid": [secteurs à éviter mentionnés],
  "zone": { "places": [{ "label": "Paris", "kind": "city" | "region" | "country", "country": "FR" }], "remoteOk": true },
  "outOfZone": "never",
  "contracts": sous-ensemble de ["cdi","cdd","stage","alternance","freelance"], vide si non précisé,
  "experienceYears": années d'expérience professionnelle réelle (stages et alternances comptés à moitié), nombre ou null,
  "languages": [langues parlées avec niveau si connu],
  "companiesAvoid": [], "companiesFollow": [],
  "dealBreakers": [contraintes rédhibitoires exprimées, phrases courtes],
  "openness": 0 à 100 (0 = uniquement le job de rêve, 100 = veut surtout commencer quelque part ; 50 si rien n'est dit)
}
Règles : n'invente rien qui contredise la description. Codes pays ISO à deux lettres. Si un lieu est une région française, utilise son nom complet (ex. "Île-de-France"). Les termes de métier ne doivent pas être spécifiques à un exemple : reprends ceux de la personne.`;

const CV_SYSTEM = `Tu lis un CV dont les données personnelles ont été retirées. Réponds uniquement avec un objet JSON :
{ "experienceYears": nombre ou null (expérience professionnelle réelle, stages et alternances comptés à moitié),
  "roles": [postes occupés], "skills": [compétences clés, 5 à 15], "languages": [langues avec niveau],
  "education": [diplômes], "highlights": [3 à 5 réalisations concrètes, chiffrées si possible] }
N'invente rien.`;

export async function extractCvSummary(redactedCv: string): Promise<CvSummary> {
  const llm = getLlm();
  if (llm) {
    try {
      const raw = await llm.json({ system: CV_SYSTEM, user: redactedCv.slice(0, 12_000), tier: "strong" });
      const parsed = CvSummary.safeParse(raw);
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to the heuristic
    }
  }
  return CvSummary.parse({ experienceYears: heuristicYears(redactedCv) });
}

export async function interpretSearch(text: string, cv: CvSummary | null): Promise<{ criteria: Criteria; source: "llm" | "heuristic" }> {
  const llm = getLlm();
  if (llm) {
    try {
      const user = `Description :\n${text.slice(0, 4000)}\n\nRésumé du CV :\n${cv ? JSON.stringify(cv) : "aucun"}`;
      const raw = await llm.json({ system: CRITERIA_SYSTEM, user, tier: "strong" });
      const parsed = Criteria.safeParse(raw);
      if (parsed.success) return { criteria: withCvFallbacks(parsed.data, cv), source: "llm" };
    } catch {
      // fall through to the heuristic
    }
  }
  return { criteria: withCvFallbacks(heuristicCriteria(text), cv), source: "heuristic" };
}

function withCvFallbacks(c: Criteria, cv: CvSummary | null): Criteria {
  if (c.experienceYears === null && cv?.experienceYears != null) c.experienceYears = cv.experienceYears;
  if (c.languages.length === 0 && cv?.languages.length) c.languages = cv.languages;
  return c;
}

function heuristicYears(text: string): number | null {
  const m = text.toLowerCase().match(/(\d{1,2})\s*(?:ans?|years?)\s+d?['’ ]?(?:exp[ée]rience|experience)/);
  return m ? Number(m[1]) : null;
}

// Deterministic fallback when no LLM is available: reads roles, places, contracts and years from the text.
function heuristicCriteria(text: string): Criteria {
  const c = emptyCriteria();
  const lower = text.toLowerCase();

  const roleMatch = text.match(/(?:je cherche|je recherche|poste de|job de|travailler comme|en tant que)\s+(?:un |une |un poste de |un job de )?([^,.;\n]{3,60})/i);
  if (roleMatch) c.targetRoles = [roleMatch[1].trim()];
  c.titleVariants = [...c.targetRoles];

  const places: ZonePlace[] = [];
  for (const chunk of text.split(/[,.;\n]| ou | et /)) {
    const parsed = parseLocation(chunk);
    for (const p of parsed.places) {
      const label = p.city ?? (p.region ? REGION_LABELS[p.region] : p.country ? COUNTRY_NAMES[p.country] ?? p.country : undefined);
      if (!label || !p.country || places.some((x) => x.label === label)) continue;
      places.push({ label, kind: p.city ? "city" : p.region ? "region" : "country", country: p.country });
    }
  }
  c.zone = { places, remoteOk: !/pas de (full )?remote|sur site uniquement/.test(lower) };

  const contracts: Criteria["contracts"] = [];
  if (/\bcdi\b/.test(lower)) contracts.push("cdi");
  if (/\bcdd\b/.test(lower)) contracts.push("cdd");
  if (/\bstage\b/.test(lower)) contracts.push("stage");
  if (/alternance/.test(lower)) contracts.push("alternance");
  if (/freelance/.test(lower)) contracts.push("freelance");
  c.contracts = contracts;

  c.experienceYears = heuristicYears(text);
  if (/peu importe|n'importe|commencer quelque part|premier job/.test(lower)) c.openness = 70;
  return c;
}
