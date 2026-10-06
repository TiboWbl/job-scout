// Case 12: turning onboarding text into criteria. The safety net always runs; the full extraction
// needs RUN_LLM_TESTS=1 and a Mistral key (`npm run test:llm`).
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { Criteria } from "@/lib/domain/criteria";
import { flattenLists, interpretSearch, reconcile } from "@/lib/profile/interpret";
import { CvSummary } from "@/lib/domain/criteria";
import { SEARCH_TEXT } from "./fixtures/extraction";

config({ path: ".env.local", quiet: true });
const LLM_ENABLED = process.env.RUN_LLM_TESTS === "1" && Boolean(process.env.MISTRAL_API_KEY);

const has = (values: string[], pattern: RegExp) => values.some((v) => pattern.test(v));

describe("filet de sécurité de l'extraction", () => {
  // What a model got wrong on the first mock run: negations inverted, role duplicated, sectors mixed up.
  const wrong = Criteria.parse({
    targetRoles: ["Product Manager", "je cherche mon premier CDI de Product Manager dans une équipe structurée"],
    titleVariants: ["Product Manager", "product manager", "Associate Product Manager"],
    sectorsPriority: ["Sport", "Jeu vidéo"],
    sectorsAvoid: ["Jeu vidéo"],
    contracts: ["cdi", "stage", "alternance"],
    outOfZone: "never",
  });
  const fixed = reconcile(wrong, SEARCH_TEXT);

  it("retire les contrats niés (« Pas de stage ni d'alternance »)", () => {
    expect(fixed.contracts).toEqual(["cdi"]);
  });
  it("ne garde jamais une phrase comme métier", () => {
    expect(fixed.targetRoles).toEqual(["Product Manager"]);
  });
  it("ne duplique pas le métier dans les intitulés équivalents", () => {
    expect(fixed.titleVariants).toEqual(["Associate Product Manager"]);
  });
  it("ne laisse pas un secteur évité parmi les prioritaires", () => {
    expect(fixed.sectorsPriority).toEqual(["Sport"]);
  });
  it("lit « à l'étranger seulement s'il est exceptionnel »", () => {
    expect(fixed.outOfZone).toBe("exceptional");
  });
  it("range en passerelle un métier cité seulement comme passerelle", () => {
    const promoted = reconcile(Criteria.parse({ targetRoles: ["Product Manager", "Product Owner", "Product Analyst"], bridgeRoles: ["QA avec évolution vers le produit"] }), SEARCH_TEXT);
    expect(promoted.targetRoles).toEqual(["Product Manager"]);
    expect(promoted.bridgeRoles).toEqual(["Product Owner", "Product Analyst", "QA avec évolution vers le produit"]);
  });
  it("ne mélange pas passerelles et intitulés équivalents", () => {
    const mixed = reconcile(Criteria.parse({ targetRoles: ["Product Manager"], titleVariants: ["Associate Product Manager", "Product Owner Junior", "Product Analyst"], bridgeRoles: ["Product Owner orienté discovery", "Product Analyst"] }), SEARCH_TEXT);
    expect(mixed.titleVariants).toEqual(["Associate Product Manager"]);
  });
  it("garde l'exclusion quand aucun contrat n'est demandé", () => {
    const none = reconcile(Criteria.parse({ contracts: [] }), "Je cherche un poste, sans alternance.");
    expect(none.contracts).not.toContain("alternance");
    expect(none.contracts).toContain("cdi");
  });
});

describe("lecture du CV", () => {
  it("accepte des éléments de liste renvoyés sous forme d'objets", () => {
    const raw = { experienceYears: "1", roles: [{ poste: "Product Owner", structure: "startup", duree: "6 mois" }], languages: [{ langue: "Anglais", niveau: "C1" }], skills: ["SQL"] };
    const cv = CvSummary.parse(flattenLists(raw));
    expect(cv.roles).toEqual(["Product Owner, startup, 6 mois"]);
    expect(cv.languages).toEqual(["Anglais, C1"]);
    expect(cv.experienceYears).toBe(1);
  });
});

describe.skipIf(!LLM_ENABLED)("12. extraction complète par le LLM", () => {
  it("comprend la recherche sans inverser de négation", async () => {
    const c = await interpretSearch(SEARCH_TEXT, null);
    const failures: string[] = [];
    const check = (ok: boolean, label: string) => !ok && failures.push(label);

    check(has(c.targetRoles, /product manager/i), `métier : ${c.targetRoles.join(", ")}`);
    check(c.targetRoles.every((r) => r.length <= 60), "métier sous forme de phrase");
    check(!c.titleVariants.some((v) => c.targetRoles.some((r) => r.toLowerCase() === v.toLowerCase())), "métier dupliqué dans les équivalents");
    for (const re of [/associate/i, /junior|jr/i, /\bapm\b/i, /chef de produit/i]) check(has(c.titleVariants, re), `équivalent manquant ${re} : ${c.titleVariants.join(", ")}`);
    for (const re of [/product analyst/i, /product owner/i, /\bqa\b|qualit/i]) check(has(c.bridgeRoles, re), `passerelle manquante ${re} : ${c.bridgeRoles.join(", ")}`);
    check(JSON.stringify(c.contracts) === JSON.stringify(["cdi"]), `contrats : ${c.contracts.join(", ")}`);
    check(c.experienceYears !== null && c.experienceYears >= 0.5 && c.experienceYears <= 1.5, `expérience : ${c.experienceYears}`);
    check(c.zone.places.some((p) => /paris/i.test(p.label)), "Paris absent");
    check(c.zone.places.some((p) => /le-de-france/i.test(p.label) && p.kind === "region"), "Île-de-France absente");
    check(c.zone.remoteOk, "télétravail complet refusé");
    check(c.outOfZone === "exceptional", `hors zone : ${c.outOfZone}`);
    check(has(c.sectorsPriority, /sport/i) && has(c.sectorsPriority, /sant/i), `secteurs prioritaires : ${c.sectorsPriority.join(", ")}`);
    check(!has(c.sectorsPriority, /pari|jeu|textile|retail/i), "secteur évité parmi les prioritaires");
    check(c.otherSectors.open, "autres secteurs refusés");
    for (const re of [/pari|jeux? d.argent/i, /jeu vid/i, /textile|retail|non digital/i]) check(has(c.sectorsAvoid, re), `secteur à éviter manquant ${re} : ${c.sectorsAvoid.join(", ")}`);
    check(has(c.companiesAvoid, /acme sport/i), `entreprises exclues : ${c.companiesAvoid.join(", ")}`);
    check(has(c.languages, /anglais|english/i) && has(c.languages, /fran/i), `langues : ${c.languages.join(", ")}`);
    check(/imm[ée]diat/i.test(c.availability ?? ""), `disponibilité : ${c.availability}`);
    expect(failures).toEqual([]);
  });
});
