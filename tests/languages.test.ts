import { describe, expect, it } from "vitest";
import { missingLanguage, requiredLanguages } from "@/lib/domain/languages";

describe("langues exigées par une offre", () => {
  it.each([
    ["Fluent in Turkish and lived in Turkey.", "turc"],
    ["Allemand courant indispensable.", "allemand"],
    ["Vous maîtrisez l'espagnol (C1).", "espagnol"],
    ["Native Japanese speaker.", "japonais"],
    ["You speak Portuguese fluently.", "portugais"],
    ["Profil bilingue français / italien.", "italien"],
    ["Dutch-speaking candidates only.", "néerlandais"],
  ])("« %s » exige %s", (text, language) => {
    expect(requiredLanguages(text).map((r) => r.language)).toContain(language);
  });
  it.each([
    "Speaking German is a plus.",
    "L'espagnol serait un plus.",
    "Tu travailleras avec nos équipes en Turquie et au Japon.",
    "Deeply tuned into Turkish memes, humour, and online culture.",
    "Fluent in English and French.",
    "• Fluent in English, and in French or German.",
    "Allemand ou anglais courant.",
  ])("« %s » n'exige aucune autre langue", (text) => {
    expect(requiredLanguages(text)).toEqual([]);
  });
  it("au choix entre deux langues étrangères, en parler une suffit", () => {
    expect(missingLanguage("Fluent in German or Dutch.", ["Néerlandais courant"])).toBeNull();
    expect(missingLanguage("Fluent in German or Dutch.", ["Anglais"])).toMatchObject({ language: "allemand" });
  });
  it("une langue parlée par la personne ne l'écarte pas", () => {
    expect(missingLanguage("Fluent in Turkish.", ["Français", "Turc courant"])).toBeNull();
    expect(missingLanguage("Fluent in Turkish.", ["Français", "Anglais (C1)"])).toMatchObject({ language: "turc", quote: "Fluent in Turkish." });
  });
});

describe("l'activité d'une entreprise vaut pour toutes ses offres", async () => {
  const { isCompanyWide } = await import("@/lib/scoring/judge");
  it.each([
    ["Application mobile Bump, croissance marché Cambodge via contenu viral", false],
    ["Jeux mobiles pour le marché turc", false],
    ["Application de suivi de rééducation pour les kinésithérapeutes", true],
    ["Leader français de la location de voitures entre particuliers", true],
  ] as const)("« %s » : %s", (activity, ok) => {
    expect(isCompanyWide(activity)).toBe(ok);
  });
});
