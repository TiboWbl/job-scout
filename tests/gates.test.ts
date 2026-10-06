import { describe, expect, it } from "vitest";
import { parseLocation, zoneVerdict } from "@/lib/domain/geo";
import { detectContract, detectExperienceYears, titleSeniorityYears } from "@/lib/domain/signals";
import { prefilter } from "@/lib/scoring/prefilter";
import { PROFILE } from "./fixtures/regression";

const PARIS = { places: [{ label: "Paris", kind: "city" as const, country: "FR" }], remoteOk: true };

function offerAt(location: string, context = "") {
  const loc = parseLocation(location, context);
  return { places: loc.places, remote: loc.remote, remote_scope: loc.remoteScope };
}

describe("zone", () => {
  it("reconnaît les villes multiples des ATS", () => {
    expect(parseLocation("Boston, Massachusetts, USA; New York, New York, USA").places).toEqual([
      { city: "Boston", country: "US", region: undefined },
      { city: "New York", country: "US", region: undefined },
    ]);
    expect(parseLocation("Paris, Paris, France").places[0]).toMatchObject({ city: "Paris", country: "FR", region: "IDF" });
  });

  it("ne confond pas Paris (Texas, Ontario) avec Paris", () => {
    expect(parseLocation("Paris, TX").places[0]).toMatchObject({ city: "Paris", country: "US" });
    expect(parseLocation("Paris, Texas, United States").places[0]).toMatchObject({ country: "US" });
    expect(parseLocation("Paris, ON, Canada").places[0]).toMatchObject({ country: "CA" });
    expect(parseLocation("Paris, Île-de-France, France").places[0]).toMatchObject({ country: "FR", region: "IDF" });
  });

  it("garde Paris, écarte New York et Boston", () => {
    expect(zoneVerdict(offerAt("Paris offices"), PARIS)).toBe("in");
    expect(zoneVerdict(offerAt("New York, New York, USA"), PARIS)).toBe("out");
    expect(zoneVerdict(offerAt("Boston, Massachusetts, USA"), PARIS)).toBe("out");
  });

  it("compte un full remote ouvert à la France, pas un remote réservé aux US", () => {
    expect(zoneVerdict(offerAt("Remote - France"), PARIS)).toBe("in");
    expect(zoneVerdict(offerAt("Remote (EMEA)"), PARIS)).toBe("in");
    expect(zoneVerdict(offerAt("Remote (US)"), PARIS)).toBe("out");
    expect(zoneVerdict(offerAt("Remote US only"), PARIS)).toBe("out");
  });

  it("ne refuse jamais un lieu illisible", () => {
    expect(zoneVerdict(offerAt("HQ"), PARIS)).toBe("unknown");
  });

  it("accepte une région ou un pays comme zone", () => {
    const idf = { places: [{ label: "Île-de-France", kind: "region" as const, country: "FR" }], remoteOk: false };
    expect(zoneVerdict(offerAt("Boulogne-Billancourt"), idf)).toBe("in");
    expect(zoneVerdict(offerAt("Lyon"), idf)).toBe("out");
    const france = { places: [{ label: "France", kind: "country" as const, country: "FR" }], remoteOk: false };
    expect(zoneVerdict(offerAt("Lyon"), france)).toBe("in");
  });
});

describe("réglage « Offres hors de ma zone »", () => {
  const ny = { title: "Product Manager", companyName: "X", contract: "cdi", experience_min_years: null, ...offerAt("New York, NY") };
  it("jamais : écartée", () => {
    expect(prefilter(ny, { ...PROFILE, outOfZone: "never" }, 1).pass).toBe(false);
  });
  it("seulement si exceptionnelle : gardée mais marquée hors zone", () => {
    expect(prefilter(ny, { ...PROFILE, outOfZone: "exceptional" }, 1)).toMatchObject({ pass: true, outOfZone: true });
  });
  it("oui : traitée normalement", () => {
    expect(prefilter(ny, { ...PROFILE, outOfZone: "yes" }, 1)).toMatchObject({ pass: true, outOfZone: false });
  });
});

describe("contrat, séniorité, expérience", () => {
  const paris = { companyName: "X", experience_min_years: null, ...offerAt("Paris") };
  it("détecte le contrat sans jamais deviner", () => {
    expect(detectContract("Stage Product Manager")).toBe("stage");
    expect(detectContract("Product Manager", "Full-time")).toBe("cdi");
    expect(detectContract("Product Management Intern", "Full-time")).toBe("stage");
    expect(detectContract("Product Manager")).toBe("unknown");
    expect(detectContract("Product Manager", null, "Profil : première expérience (stage ou alternance acceptés). CDI.")).toBe("cdi");
    expect(detectContract("Product Manager", null, "Profil : première expérience en stage appréciée.")).toBe("unknown");
  });
  it("écarte un contrat non retenu, garde un contrat inconnu", () => {
    expect(prefilter({ ...paris, title: "PM", contract: "stage" }, PROFILE, 1).pass).toBe(false);
    expect(prefilter({ ...paris, title: "PM", contract: "unknown" }, PROFILE, 1).pass).toBe(true);
  });
  it("lit l'expérience demandée en français et en anglais", () => {
    expect(detectExperienceYears("Vous avez 3 ans d'expérience minimum")).toBe(3);
    expect(detectExperienceYears("5+ years of product management experience")).toBe(5);
    expect(detectExperienceYears("2 à 4 ans d'expérience")).toBe(2);
    expect(detectExperienceYears("Débutant accepté")).toBeNull();
  });
  it("la séniorité dépend de l'expérience de la personne", () => {
    expect(titleSeniorityYears("Senior Product Manager")).toBeGreaterThan(0);
    const senior = { ...paris, title: "Senior Product Manager", contract: "cdi" };
    expect(prefilter(senior, PROFILE, 1).pass).toBe(false);
    expect(prefilter(senior, PROFILE, 5).pass).toBe(true);
  });
  it("un écart d'expérience est une porte, pas un point", () => {
    const sixYears = { ...paris, title: "Product Manager", contract: "cdi", experience_min_years: 6 };
    expect(prefilter(sixYears, PROFILE, 1).pass).toBe(false);
    expect(prefilter({ ...sixYears, experience_min_years: 3 }, PROFILE, 1).pass).toBe(true);
  });
});

describe("séniorité et écart d'expérience (portes)", () => {
  const offer = (title: string, experience_min_years: number | null = null) => ({
    title,
    companyName: "Entreprise fictive",
    places: [{ city: "Paris", country: "FR", region: "IDF" }],
    remote: "hybrid" as const,
    remote_scope: [],
    contract: "cdi",
    experience_min_years,
  });

  it("écarte Senior et Lead pour 1 an d'expérience, les garde avec chances basses pour 2 ans", () => {
    expect(prefilter(offer("Senior Product Manager"), PROFILE, 1).pass).toBe(false);
    expect(prefilter(offer("Lead Product Manager"), PROFILE, 1).pass).toBe(false);
    expect(prefilter(offer("Senior Product Manager"), PROFILE, 2)).toMatchObject({ pass: true, experienceGap: 3 });
  });

  it("garde un écart de 2 ans, écarte un écart de 4 ans", () => {
    expect(prefilter(offer("Product Manager II"), PROFILE, 1)).toMatchObject({ pass: true, experienceGap: 2 });
    expect(prefilter(offer("Product Manager", 3), PROFILE, 1)).toMatchObject({ pass: true, experienceGap: 2 });
    expect(prefilter(offer("Product Manager", 5), PROFILE, 1).pass).toBe(false);
  });

  it("réduit les chances en proportion de l'écart", async () => {
    const { chancesCap } = await import("@/lib/scoring/prefilter");
    expect([0, 1, 2, 3].map(chancesCap)).toEqual([100, 80, 60, 35]);
  });
});

describe("expérience demandée lue dans l'offre", () => {
  const cases: [string, number | null][] = [
    ["Must-haves - 3+ years in product management, ideally in a mobile-first consumer app", 3],
    ["At least 5 years in a product role (or equivalent product ownership)", 5],
    ["You have 6+ years of experience as a Backend Engineer", 6],
    ["4 years as a Product Manager in a B2B SaaS", 4],
    ["Tu as 2 ans d'expérience minimum en tant que Product Owner", 2],
    ["Vous justifiez de 3 ans en gestion de produit digital", 3],
    ["2 à 4 ans sur un poste similaire", 2],
    ["Expérience de 3 ans minimum dans le produit", 3],
    ["Une première expérience de 1 an est un plus", 1],
    ["3-5 years' experience in product", 3],
    ["Depuis 15 ans, nous accompagnons nos clients", null],
    ["Fondée il y a 10 ans, notre entreprise compte 200 personnes", null],
    ["We've grown 3x over the past 2 years in Europe", null],
    ["Theodo connait une croissance exceptionnelle depuis 15 ans", null],
  ];
  for (const [text, years] of cases) {
    it(`« ${text.slice(0, 50)} » → ${years ?? "rien"}`, () => {
      expect(detectExperienceYears(text)).toBe(years);
    });
  }
});

describe("expérience en fourchette", async () => {
  const { detectExperience, experienceLabel } = await import("@/lib/domain/signals");
  const cases: [string, number | null, number | null, string | null][] = [
    ["Tu es diplômé(e) d'une école d'ingénieur avec jusqu'à 2 ans d'expérience professionnelle", 0, 2, "0 à 2 ans"],
    ["Expérience : 3-6 ans dans un rôle produit", 3, 6, "3 à 6 ans"],
    ["Vous avez entre 2 à 4 ans d'expérience en gestion de projet", 2, 4, "2 à 4 ans"],
    ["Must-haves - 3+ years in product management", 3, null, "3 ans et plus"],
    ["Up to 2 years of experience in a product team", 0, 2, "0 à 2 ans"],
    ["Moins de 3 ans d'expérience", 0, 3, "0 à 3 ans"],
  ];
  for (const [text, min, max, label] of cases) {
    it(`« ${text.slice(0, 45)} » → ${label}`, () => {
      expect(detectExperience(text)).toEqual({ min, max });
      expect(experienceLabel(min, max)).toBe(label);
    });
  }
});
