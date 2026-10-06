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
