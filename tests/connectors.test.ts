// Connectors read public feeds whose format we do not control: fixtures pin what we rely on.
import { afterEach, describe, expect, it, vi } from "vitest";
import { personio, teamtailor } from "@/lib/collect/connectors/ats-more";
import { slugGuesses } from "@/lib/collect/discover";
import { keepInScope } from "@/lib/collect/run";

const board = { name: "Entreprise Fictive", domain: null, token: "fictive" };

function serve(body: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("flux Teamtailor", () => {
  it("lit titre, lieu, télétravail, description et date", async () => {
    serve(`<rss><channel><title>Entreprise Fictive - Carrières</title>
      <item><title>Product Manager</title>
        <description>&lt;p&gt;Tu pilotes la &lt;strong&gt;discovery&lt;/strong&gt;.&lt;/p&gt;</description>
        <pubDate>Tue, 30 Sep 2026 10:00:00 +0200</pubDate>
        <link>https://fictive.teamtailor.com/jobs/1-product-manager</link>
        <remoteStatus>hybrid</remoteStatus>
        <tt:locations><tt:location><tt:city>Paris</tt:city><tt:country>France</tt:country></tt:location></tt:locations>
      </item></channel></rss>`);
    const [offer] = await teamtailor(board);
    expect(offer).toMatchObject({ title: "Product Manager", remote: "hybrid", company: { name: "Entreprise Fictive" }, applyUrl: "https://fictive.teamtailor.com/jobs/1-product-manager" });
    expect(offer.places[0]).toMatchObject({ city: "Paris", country: "FR" });
    expect(offer.description).toContain("Tu pilotes la discovery.");
    expect(offer.publishedAt).toBe("2026-09-30T08:00:00.000Z");
  });
});

describe("flux Personio", () => {
  it("lit le poste, le bureau, le contrat et les sections de description", async () => {
    serve(`<workzag-jobs><position><id>42</id><subcompany>Entreprise Fictive</subcompany><office>Lyon</office>
      <name>Chef de produit digital</name><employmentType>permanent</employmentType><createdAt>2026-09-20T09:00:00+00:00</createdAt>
      <jobDescriptions><jobDescription><name>Missions</name><value><![CDATA[<p>Construire la roadmap.</p>]]></value></jobDescription></jobDescriptions>
      </position></workzag-jobs>`);
    const [offer] = await personio(board);
    expect(offer).toMatchObject({ title: "Chef de produit digital", contract: "cdi", applyUrl: "https://fictive.jobs.personio.de/job/42" });
    expect(offer.places[0]).toMatchObject({ city: "Lyon", country: "FR" });
    expect(offer.description).toContain("Construire la roadmap.");
  });
});

describe("découverte", () => {
  it("devine les adresses de page carrière à partir du nom", () => {
    expect(slugGuesses("Acme Sport SAS")).toEqual(["acmesport", "acme-sport"]);
  });
});

describe("filtre géographique à la collecte", () => {
  const keep = keepInScope({ queries: [], countries: new Set(["FR"]), wanted: () => true });
  it("garde la France, écarte le reste et les lieux inconnus", () => {
    expect(keep([{ city: "Paris", country: "FR" }], "hybrid")).toBe(true);
    expect(keep([], "remote")).toBe(false);
    expect(keep([{ city: "Boston", country: "US" }], "onsite")).toBe(false);
  });
  it("garde tout tant qu'aucun profil n'existe", () => {
    expect(keepInScope({ queries: [], countries: new Set(), wanted: () => true })([{ city: "Boston", country: "US" }], "onsite")).toBe(true);
  });
});

describe("liste d'entreprises favorites", () => {
  it("lit une entreprise par ligne, des virgules, des URL et un CSV à deux colonnes", async () => {
    const { parseEntries } = await import("@/components/favorites");
    expect(parseEntries("Acme Sport\nExemple Santé, Autre Boîte\nhttps://jobs.lever.co/acme")).toEqual([{ name: "Acme Sport" }, { name: "Exemple Santé" }, { name: "Autre Boîte" }, { site: "https://jobs.lever.co/acme" }]);
    expect(parseEntries("entreprise,site\nAcme Sport,https://acme.fr\nExemple Santé,")).toEqual([{ name: "Acme Sport", site: "https://acme.fr" }, { name: "Exemple Santé", site: undefined }]);
  });
});

describe("descriptions restructurées", async () => {
  const { structureDescription } = await import("@/lib/format-description");
  it("isole les rubriques et transforme les tirets en liste", () => {
    const flat = "Rejoins une équipe produit en croissance à Paris. Tes missions : - Prioriser le backlog - Mener la discovery - Suivre les KPIs. Profil recherché : jusqu'à 2 ans d'expérience en produit.";
    const out = structureDescription(flat).split("\n");
    expect(out).toContain("Tes missions :");
    expect(out).toContain("• Prioriser le backlog");
    expect(out).toContain("Profil recherché :");
  });
  it("laisse intact un texte déjà structuré", () => {
    const ok = "Missions\n• Une\n• Deux\nProfil\n• Trois";
    expect(structureDescription(ok)).toBe(ok);
  });
});

describe("même entreprise, nom de page carrière différent", async () => {
  const { companyKey } = await import("@/lib/collect/normalize");
  it("ignore le suffixe numérique des adresses (Robeaute-1)", () => {
    expect(companyKey("Robeaute-1")).toBe(companyKey("Robeaute"));
    expect(companyKey("1&1")).not.toBe("");
  });
});
