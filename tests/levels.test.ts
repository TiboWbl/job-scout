// The level is derived from the model's answers by a fixed rule: constraints are gates, never averaged.
import { describe, expect, it } from "vitest";
import { Criteria } from "@/lib/domain/criteria";
import { deriveLevel, type Facts } from "@/lib/scoring/judge";

const open = Criteria.parse({});
const closed = Criteria.parse({ otherSectors: { open: false } });
const facts = (f: Partial<Facts>): Facts => ({ match: "metier_vise", sector: "prioritaire", trap: null, dealBreaker: null, chances: 70, ...f });

describe("niveau dérivé des réponses du modèle", () => {
  it("métier visé dans un secteur prioritaire avec des chances : coup de cœur", () => {
    expect(deriveLevel(facts({}), open).level).toBe("coeur");
  });
  it("métier visé mais chances faibles : solide", () => {
    expect(deriveLevel(facts({ chances: 30 }), open).level).toBe("solide");
  });
  it("métier visé dans un autre secteur : solide si la personne est ouverte, écartée sinon", () => {
    expect(deriveLevel(facts({ sector: "autre" }), open).level).toBe("solide");
    expect(deriveLevel(facts({ sector: "autre" }), closed).level).toBe("ecartee");
  });
  it("passerelle : tremplin", () => {
    expect(deriveLevel(facts({ match: "passerelle" }), open).level).toBe("tremplin");
  });
  it("un secteur à éviter écarte même un excellent poste", () => {
    expect(deriveLevel(facts({ sector: "a_eviter" }), open)).toEqual({ level: "ecartee", reason: "Secteur que tu as choisi d'éviter." });
  });
  it("un piège écarte le poste et donne sa raison", () => {
    expect(deriveLevel(facts({ trap: "Poste commercial déguisé." }), open)).toEqual({ level: "ecartee", reason: "Poste commercial déguisé." });
  });
  it("un deal-breaker l'emporte sur tout le reste", () => {
    expect(deriveLevel(facts({ dealBreaker: "Astreintes le week-end." }), open).level).toBe("ecartee");
  });
});
