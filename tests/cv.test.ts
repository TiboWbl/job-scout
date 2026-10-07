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

describe("mots-clés et chiffres", async () => {
  const { hasKeyword, scoreCv } = await import("@/lib/cv/ats");
  it("une barre est une alternative, le pluriel compte", () => {
    const cv = "methodes agile (scrum), okr trimestriels, suivi dans jira";
    expect(hasKeyword(cv, "Agile/Scrum")).toBe(true);
    expect(hasKeyword(cv, "OKRs")).toBe(true);
    expect(hasKeyword(cv, "Jira/Confluence")).toBe(true);
    expect(hasKeyword(cv, "A/B testing")).toBe(false);
  });
  it("un mot-clé se lit en mot entier, jamais dans un autre mot", () => {
    expect(hasKeyword("un parcours rapide et simple", "API")).toBe(false);
    expect(hasKeyword("integration d'une api de paiement", "API")).toBe(true);
    expect(hasKeyword("campagnes d'a/b tests sur l'onboarding", "A/B test")).toBe(true);
  });
  it("un verbe d'action compte en début de mission, une fois par ligne", () => {
    const text = "• Piloté la roadmap produit de bout en bout\n• Responsable du crédit et de la relation créative avec les clients\n• Lancé et piloté deux nouvelles offres B2B";
    const r = scoreCv({ text, layout: { pages: 1, columnRatio: 0, spacedTitles: 0 }, filename: "cv.pdf", sizeBytes: 1000 }, { expected: [] });
    expect(r.categories[2].checks.find((c) => c.label === "Verbes d'action")!.points).toBe(3);
  });
  it("compte les résultats chiffrés sous leurs formes courantes", () => {
    const text = "Augmenté la conversion de 25 %. Divisé par 2 le délai (x2). Accompagné 12 clients grands comptes. Lancé une app pour 3 000 utilisateurs. Budget de 50 k€.";
    const r = scoreCv({ text, layout: { pages: 1, columnRatio: 0, spacedTitles: 0 }, filename: "cv.pdf", sizeBytes: 1000 }, { expected: [] });
    const figures = r.categories[2].checks.find((c) => c.label === "Résultats chiffrés")!;
    expect(figures.ok).toBe(true);
  });
});

describe("compétences demandées par la sélection", async () => {
  const { topSkills } = await import("@/lib/views/skills");
  const { checkedSkills } = await import("@/lib/scoring/judge");
  it("garde seulement les compétences écrites dans l'offre", () => {
    expect(checkedSkills([{ nom: "SQL", type: "outil" }, { nom: "Kubernetes", type: "outil" }, { nom: "Esprit d'équipe", type: "savoir_etre" }], "Tu maîtrises SQL et tu as l'esprit d'équipe.")).toEqual([
      { name: "SQL", kind: "outil" },
      { name: "Esprit d'équipe", kind: "savoir_etre" },
    ]);
  });
  it("compte chaque compétence une fois par offre, réunit les pluriels et la compare au CV", () => {
    const offers = [
      { skills: [{ name: "Roadmap", kind: "methode" as const }, { name: "SQL", kind: "outil" as const }] },
      { skills: [{ name: "roadmaps", kind: "methode" as const }, { name: "Figma", kind: "outil" as const }] },
      { skills: [{ name: "Roadmap", kind: "methode" as const }, { name: "SQL", kind: "outil" as const }] },
      { skills: null },
    ];
    const r = topSkills(offers, "Compétences : SQL, Jira");
    expect(r.read).toBe(3);
    expect(r.byKind.methode[0]).toMatchObject({ name: "Roadmap", count: 3, share: 100, inCv: false });
    expect(r.byKind.outil[0]).toMatchObject({ name: "SQL", count: 2, inCv: true });
    expect(r.byKind.outil.some((s) => s.name === "Figma")).toBe(false);
  });
});

describe("email des coups de cœur", async () => {
  const { digestHtml } = await import("@/lib/digest");
  it("échappe les textes des offres et rappelle comment le désactiver", () => {
    const html = digestHtml("Camille", [{ id: "1", title: "PM <Junior>", company: "Fictive & Co", why: null }]);
    expect(html).toContain("PM &lt;Junior&gt;");
    expect(html).toContain("Fictive &amp; Co");
    expect(html).toContain("Paramètres");
  });
});

describe("ce que demande le métier, compté dans les textes", async () => {
  const { skillDemand } = await import("@/lib/views/skills");
  const vocab = [
    { name: "Roadmap", kind: "methode" as const },
    { name: "roadmap produit", kind: "methode" as const },
    { name: "Jira", kind: "outil" as const },
    { name: "expérience utilisateur", kind: "methode" as const },
    { name: "Swile", kind: "outil" as const },
    { name: "Product Manager", kind: "methode" as const },
  ];
  it("compte chaque compétence dans le texte complet, réunit les variantes, écarte ce qui n'en est pas", () => {
    const texts = ["Tu construis la roadmap produit avec Jira.", "Tu tiens la roadmap. Tickets Swile.", "Une belle expérience utilisateur et une roadmap claire.", "Process de recrutement en deux étapes."];
    const r = skillDemand(texts, vocab, "Jira", ["Jira"]);
    expect(r.read).toBe(4);
    expect(r.byKind.methode[0]).toMatchObject({ name: "Roadmap", count: 3, share: 75 });
    expect(r.byKind.outil.map((s) => s.name)).not.toContain("Swile");
    expect(r.byKind.methode.map((s) => s.name)).not.toContain("Product Manager");
  });
});
