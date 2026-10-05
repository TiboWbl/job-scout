import { SearchCriteria } from "./types";

export type FindingStatus = "ok" | "warning" | "critical";

export interface CvFinding {
  id: string;
  label: string;
  status: FindingStatus;
  detail: string;
}

export interface CvAnalysisResult {
  score: number;
  findings: CvFinding[];
  wordCount: number;
}

const ACTION_VERBS = [
  "pilot", "gér", "développ", "conç", "lanc", "augment", "réduit", "réduis", "optimis", "dirig",
  "coordonn", "anim", "construit", "déploy", "améliор", "amélior", "accélér", "structur", "négoci",
  "recrut", "form", "encadr", "analys", "conduit", "rédig", "implément", "automatis", "livr", "créé", "crée",
];

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const PHONE_REGEX = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/;

const SECTION_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "Expérience", regex: /exp[ée]riences?( professionnelles?)?/i },
  { label: "Formation", regex: /formations?|[ée]ducation|dipl[ôo]mes?/i },
  { label: "Compétences", regex: /comp[ée]tences?|skills/i },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pushFinding(
  findings: CvFinding[],
  weights: number[],
  earned: number[],
  weight: number,
  id: string,
  label: string,
  status: FindingStatus,
  detail: string,
  points: number,
) {
  findings.push({ id, label, status, detail });
  weights.push(weight);
  earned.push(points);
}

export function analyzeCv(text: string, criteria?: SearchCriteria): CvAnalysisResult {
  const clean = text.trim();
  const wordCount = countWords(clean);
  const lower = clean.toLowerCase();

  const findings: CvFinding[] = [];
  const weights: number[] = [];
  const earned: number[] = [];

  // Longueur
  {
    const weight = 15;
    let status: FindingStatus = "ok";
    let detail = `${wordCount} mots, une longueur adaptée pour un CV lu rapidement.`;
    let points = weight;
    if (wordCount < 120) {
      status = "critical";
      detail = `Seulement ${wordCount} mots : trop court pour détailler tes expériences et missions.`;
      points = 0;
    } else if (wordCount < 180) {
      status = "warning";
      detail = `${wordCount} mots : un peu court, ajoute des détails sur tes réalisations.`;
      points = weight * 0.5;
    } else if (wordCount > 1300) {
      status = "critical";
      detail = `${wordCount} mots : bien trop long, resserre sur 1 à 2 pages.`;
      points = 0;
    } else if (wordCount > 900) {
      status = "warning";
      detail = `${wordCount} mots : un peu long, vise la concision.`;
      points = weight * 0.5;
    }
    pushFinding(findings, weights, earned, weight, "longueur", "Longueur du CV", status, detail, points);
  }

  // Coordonnées
  {
    const weight = 15;
    const hasEmail = EMAIL_REGEX.test(clean);
    const hasPhone = PHONE_REGEX.test(clean);
    let status: FindingStatus = "ok";
    let detail = "Email et téléphone détectés : un recruteur peut te recontacter facilement.";
    let points = weight;
    if (hasEmail && !hasPhone) {
      status = "warning";
      detail = "Email détecté mais pas de téléphone, ajoute-le en en-tête.";
      points = weight * 0.6;
    } else if (!hasEmail && hasPhone) {
      status = "warning";
      detail = "Téléphone détecté mais pas d'email, ajoute-le en en-tête.";
      points = weight * 0.6;
    } else if (!hasEmail && !hasPhone) {
      status = "critical";
      detail = "Aucune coordonnée détectée : un recruteur doit pouvoir te joindre sans chercher.";
      points = 0;
    }
    pushFinding(findings, weights, earned, weight, "coordonnees", "Coordonnées de contact", status, detail, points);
  }

  // Sections clés
  {
    const weight = 20;
    const found = SECTION_PATTERNS.filter((s) => s.regex.test(clean));
    const missing = SECTION_PATTERNS.filter((s) => !s.regex.test(clean));
    const points = (found.length / SECTION_PATTERNS.length) * weight;
    const status: FindingStatus = found.length === SECTION_PATTERNS.length ? "ok" : found.length === 0 ? "critical" : "warning";
    const detail =
      missing.length === 0
        ? "Les sections Expérience, Formation et Compétences sont bien présentes."
        : `Section${missing.length > 1 ? "s" : ""} manquante${missing.length > 1 ? "s" : ""} ou pas clairement identifiée${missing.length > 1 ? "s" : ""} : ${missing.map((m) => m.label).join(", ")}.`;
    pushFinding(findings, weights, earned, weight, "sections", "Sections clés", status, detail, points);
  }

  // Réalisations concrètes
  {
    const weight = 20;
    const numberMatches = clean.match(/\d+\s?%|\d{2,}/g)?.length ?? 0;
    const verbMatches = ACTION_VERBS.filter((v) => lower.includes(v)).length;
    let status: FindingStatus = "ok";
    let detail = "Bonne présence de résultats chiffrés et de verbes d'action.";
    let points = weight;
    if (numberMatches < 1 && verbMatches < 2) {
      status = "critical";
      detail = "Aucun résultat chiffré ni verbe d'action détecté : quantifie tes réalisations (\"+20% d'activation\", \"piloté une équipe de 5\").";
      points = 0;
    } else if (numberMatches < 2 || verbMatches < 3) {
      status = "warning";
      detail = "Quelques résultats chiffrés ou verbes d'action présents, renforce avec plus de métriques concrètes.";
      points = weight * 0.55;
    }
    pushFinding(findings, weights, earned, weight, "realisations", "Réalisations quantifiées", status, detail, points);
  }

  // Structure / lisibilité
  {
    const weight = 10;
    const lines = clean.split("\n").filter((l) => l.trim() !== "");
    const avgWordsPerLine = lines.length > 0 ? wordCount / lines.length : wordCount;
    let status: FindingStatus = "ok";
    let detail = "Le texte semble structuré en lignes/puces courtes, lisible pour un ATS.";
    let points = weight;
    if (lines.length <= 2) {
      status = "warning";
      detail = "Le texte semble former un seul bloc, utilise des puces et des sauts de ligne entre sections.";
      points = weight * 0.4;
    } else if (avgWordsPerLine > 30) {
      status = "warning";
      detail = "Des lignes très longues, des paragraphes courts et des puces se parsent mieux.";
      points = weight * 0.6;
    }
    pushFinding(findings, weights, earned, weight, "structure", "Structure & lisibilité", status, detail, points);
  }

  // Alignement avec les critères de recherche
  const searchTerms = criteria ? [...criteria.jobTitles, ...criteria.missionKeywords, ...criteria.domains] : [];
  if (searchTerms.length > 0) {
    const weight = 20;
    const matched = searchTerms.filter((t) => lower.includes(t.toLowerCase()));
    const ratio = matched.length / searchTerms.length;
    const points = ratio * weight;
    const status: FindingStatus = ratio >= 0.6 ? "ok" : ratio >= 0.25 ? "warning" : "critical";
    const detail =
      matched.length === 0
        ? "Aucun des mots-clés de tes critères de recherche n'apparaît dans le CV, ça peut pénaliser le tri automatique des ATS."
        : `${matched.length}/${searchTerms.length} mots-clés de tes critères retrouvés dans le CV (${matched.slice(0, 4).join(", ")}${matched.length > 4 ? "…" : ""}).`;
    pushFinding(findings, weights, earned, weight, "alignement", "Alignement avec tes critères", status, detail, points);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const totalEarned = earned.reduce((a, b) => a + b, 0);
  const score = totalWeight > 0 ? Math.round((totalEarned / totalWeight) * 100) : 0;

  const order: Record<FindingStatus, number> = { critical: 0, warning: 1, ok: 2 };
  findings.sort((a, b) => order[a.status] - order[b.status]);

  return { score, findings, wordCount };
}
