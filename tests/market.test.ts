// Mon marché drives direct changes to a CV: every figure must be the one counted in the offers.
// A small fictional market where each expected number is known in advance.
import { describe, expect, it } from "vitest";
import { Criteria } from "@/lib/domain/criteria";
import { computeMarket, salaryMidpoint, type MarketDataset } from "@/lib/market/compute";
import { marketInsights } from "@/lib/market/advice";

const AT = new Date("2026-10-15T12:00:00Z");
const criteria = Criteria.parse({ targetRoles: ["Comptable"], titleVariants: ["Accountant"] });
const pad = "Tu rejoins une équipe à taille humaine et tu participes à la vie du service au quotidien. ".repeat(14);

type Over = Partial<MarketDataset["rows"][number]> & { id: string; title: string; text: string };
let n = 0;
function dataset(offers: Over[]): MarketDataset {
  const rows = offers.map((o) => ({
    company_id: `c${n++}`,
    first_seen_at: "2026-10-01T00:00:00Z",
    published_at: "2026-10-01T00:00:00Z",
    archived_at: null,
    skills: [
      { name: "SAP", kind: "outil" as const },
      { name: "Excel", kind: "outil" as const },
      { name: "Autonomie", kind: "savoir_etre" as const },
    ],
    experience_min_years: null,
    experience_level: null,
    salary_text: null,
    remote: "unknown",
    contract: "cdi",
    sources: ["greenhouse:x"],
    ...o,
    text: undefined,
  }));
  const texts = new Map(offers.map((o) => [o.id, o.text]));
  return { rows, vocabulary: rows.flatMap((r) => r.skills ?? []), description: async () => texts, company: async () => new Map() };
}

describe("Mon marché : chaque chiffre est celui compté", () => {
  it("une même annonce trouvée deux fois compte une fois, la page de l'employeur gardée", async () => {
    const same = `Tu tiens la comptabilité sur SAP et Excel. ${pad}`;
    const m = await computeMarket(
      dataset([
        { id: "a", title: "Comptable (H/F)", text: same },
        { id: "b", title: "Comptable (H/F)", text: same, sources: ["adzuna"] },
        { id: "c", title: "Comptable fournisseurs", text: `Tu tiens la comptabilité sur Excel. ${pad}` },
      ]),
      criteria,
      { at: AT },
    );
    expect(m.total).toBe(2);
    expect(m.skills.find((s) => s.key === "excel")).toMatchObject({ count: 2, share: 100 });
    expect(m.skills.find((s) => s.key === "sap")).toBeUndefined(); // cited by one offer only: not a trend
  });

  it("le salaire débutant ne compte ni gratification de stage, ni salaire net", async () => {
    const offers: Over[] = [
      ...[30, 32, 34, 36, 38].map((k, i) => ({ id: `j${i}`, title: "Comptable junior", text: `Poste ${i}. ${pad}`, salary_text: `${k} k€ brut par an`, experience_min_years: 1 })),
      { id: "s1", title: "Stage - Comptable", text: `Stage 1. ${pad}`, salary_text: "1 400 € par mois", contract: "stage" },
      { id: "s2", title: "Comptable en alternance", text: `Alternance. ${pad}`, salary_text: "1 300 € par mois", contract: "alternance" },
      { id: "n1", title: "Comptable junior", text: `Poste net. ${pad}`, salary_text: "25 k€ net par an", experience_min_years: 0 },
    ];
    const m = await computeMarket(dataset(offers), criteria, { at: AT });
    expect(m.salaries.junior).toMatchObject({ median: 34, n: 5 });
  });

  it("« affichée junior » veut dire junior dans l'intitulé, jamais un stage ni « première expérience de 5 ans »", async () => {
    const m = await computeMarket(
      dataset([
        { id: "1", title: "Comptable junior", text: `Un. ${pad}`, experience_min_years: 2 },
        { id: "2", title: "Comptable junior", text: `Deux. ${pad}`, experience_min_years: 0 },
        { id: "3", title: "Comptable (H/F)", text: `Une première expérience de 5 ans. ${pad}`, experience_min_years: 5, experience_level: "junior" },
        { id: "4", title: "Stagiaire comptable", text: `Quatre. ${pad}`, contract: "stage" },
      ]),
      criteria,
      { at: AT },
    );
    expect(m.experience.juniorLabeled).toBe(2);
    expect(m.experience.juniorAsking2).toBe(1);
  });

  it("le savoir-être n'entre pas dans les compétences à ajouter", async () => {
    const offers: Over[] = Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, title: "Comptable", text: `Autonomie et Excel. ${i} ${pad}` }));
    const m = await computeMarket(dataset(offers), criteria, { at: AT });
    const insights = marketInsights(m);
    expect([...insights.add, ...insights.show].map((i) => i.name)).toEqual(["Excel"]);
  });
});

describe("salaire annuel", () => {
  it.each([
    ["45 à 55 k€ brut par an", 50],
    ["1 867 € à 2 134 € par mois", 24],
    ["2 000 € à 3 000 € par mois", 30],
    ["30 k€ net par an", null],
  ] as const)("« %s » → %s k€", (text, expected) => {
    expect(salaryMidpoint(text)).toBe(expected);
  });
});

describe("Mon CV et Mon marché disent la même chose", () => {
  it("la grille du CV reprend les compétences du marché et leur verdict", async () => {
    const { scoreCv } = await import("@/lib/cv/ats");
    const { inCvCheck } = await import("@/lib/views/skills");
    const cv = "Expérience\nPiloté la roadmap produit et le backlog, en méthode agile.\nCompétences\nSQL";
    const top = [
      { name: "Roadmap", key: "roadmap" },
      { name: "Vision produit", key: "vision produit" },
      { name: "Backlog", key: "backlog" },
    ];
    const has = inCvCheck(cv, []);
    const result = scoreCv({ text: cv, layout: { pages: 1, columnRatio: 0, spacedTitles: 0 }, filename: "cv.pdf", sizeBytes: 100_000 }, { expected: top.map((t) => t.name), present: top.filter((t) => has(t.key)).map((t) => t.name) });
    const check = result.categories.flatMap((c) => c.checks).find((c) => c.label.startsWith("Mots-clés"))!;
    // "vision" and "produit" are both in the CV, but not the phrase "vision produit": absent, as in Mon marché.
    expect(check.label).toBe("Mots-clés du métier visé (2/3)");
    expect(check.fix).toContain("Vision produit");
    expect(result.keywords).toEqual(["Roadmap", "Vision produit", "Backlog"]);
  });
});
