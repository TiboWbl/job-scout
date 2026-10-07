// Scout's CV grid on a fictional CV: every point lost must come with its fix.
import { describe, expect, it } from "vitest";
import { compareKeywords, contactsFound, scoreCv } from "@/lib/cv/ats";

const GOOD = `Camille Exemple
camille@example.com · 06 12 34 56 78
Product Manager
Expérience professionnelle
Product Owner, Fictive Santé, janvier 2024 - décembre 2025
• Piloté la roadmap de l'application patient : +30 % d'adoption en 6 mois
• Lancé un parcours de prise de rendez-vous utilisé par 2 000 utilisateurs
• Conduit 25 entretiens de discovery avec des kinésithérapeutes
• Réduit le délai de livraison de 15 % en automatisant les tests
• Analysé les données d'usage en SQL pour prioriser le backlog
• Défini les indicateurs de succès et animé les rituels agiles
• Coordonné 6 développeurs et 1 designer
• Livré 4 fonctionnalités majeures
Formation
Diplôme d'ingénieur, École Fictive, 2019 - 2024
Compétences
Roadmap, discovery, SQL, A/B test, Jira, Figma
Langues
Anglais : courant (C1)
${"Contexte : produit B2C de santé numérique, équipe pluridisciplinaire, méthodes agiles. ".repeat(25)}`;

const layout = { pages: 1, columnRatio: 0.05, spacedTitles: 0 };

describe("grille CV", () => {
  it("un CV clair obtient une bonne note et chaque catégorie a son maximum", () => {
    const r = scoreCv({ text: GOOD, layout, filename: "CV Camille Exemple - Product Manager.pdf", sizeBytes: 300_000 }, { expected: ["roadmap", "discovery", "SQL", "Jira"] });
    expect(r.categories.map((c) => c.max)).toEqual([40, 20, 25, 15]);
    expect(r.total).toBeGreaterThanOrEqual(85);
  });
  it("un CV en image, en colonnes, aux titres espacés perd des points, avec la correction", () => {
    const r = scoreCv({ text: "E X P E R I E N C E", layout: { pages: 3, columnRatio: 0.6, spacedTitles: 3 }, filename: "document(1).pdf", sizeBytes: 4_000_000 }, { expected: ["roadmap"] });
    const lisibilite = r.categories[0];
    expect(lisibilite.score).toBe(0);
    expect(lisibilite.checks.every((c) => c.ok || c.fix)).toBe(true);
    expect(r.total).toBeLessThan(20);
  });
  it("trouve email et téléphone par regex, sans prendre une année pour un numéro", () => {
    expect(contactsFound("camille@example.com · +33 6 12 34 56 78")).toEqual({ email: true, phone: true });
    expect(contactsFound("2019 - 2024, 30 % d'adoption")).toEqual({ email: false, phone: false });
  });
  it("compare aux mots-clés d'une offre, accents et casse ignorés", () => {
    expect(compareKeywords("Analyse SQL, découverte utilisateur", ["sql", "Découverte", "Amplitude"])).toEqual({ present: ["sql", "Découverte"], missing: ["Amplitude"], score: 67 });
  });
});
