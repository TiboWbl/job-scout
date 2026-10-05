import { describe, expect, it } from "vitest";
import { redactPersonalData } from "@/lib/privacy/redact";
import { contrast, dominantColor, tokens } from "@/lib/design/color";
import { dedupKey, htmlToText } from "@/lib/collect/normalize";

describe("rédaction des données personnelles du CV", () => {
  const cv = `Camille Martin
Product Manager
camille.martin@example.com · +33 6 12 34 56 78 · linkedin.com/in/camille-martin
12 rue des Lilas, 75011 Paris

Expérience
Product Owner, 2024-2025 : piloté un projet B2B, +30 % d'adoption.`;

  const out = redactPersonalData(cv, ["Camille Martin"]);

  it("retire nom, email, téléphone, lien et adresse", () => {
    expect(out).not.toMatch(/Camille|Martin|example\.com|12 34 56|linkedin|Lilas|75011/);
  });
  it("garde le contenu professionnel, y compris dates et chiffres", () => {
    expect(out).toContain("Product Owner, 2024-2025");
    expect(out).toContain("+30 %");
  });
});

describe("couleurs d'entreprise", () => {
  const brandColors = ["#0e7fb8", "#2479bf", "#f2545b", "#14a37f", "#5b4bdb", "#00b388", "#ffcc00", "#e8308a", "#1d1d1b", null];
  for (const hex of brandColors) {
    it(`${hex ?? "repli neutre"} passe WCAG AA en clair et en sombre`, () => {
      expect(tokens(hex, "light").pass).toBe(true);
      expect(tokens(hex, "dark").pass).toBe(true);
    });
  }
  it("les fonds restent très clairs en mode clair", () => {
    expect(contrast(tokens("#f2545b", "light").bg, "#ffffff")).toBeLessThan(1.2);
  });
  it("un logo noir et blanc n'a pas de couleur dominante", () => {
    const px = new Uint8Array(48 * 48 * 4);
    for (let i = 0; i < px.length; i += 4) px.set(i % 8 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255], i);
    expect(dominantColor(px)).toBeNull();
  });
});

describe("normalisation", () => {
  it("garde la structure de la description", () => {
    expect(htmlToText("<h2>Profil recherché</h2><ul><li>Anglais</li><li>SQL</li></ul>")).toBe("Profil recherché\n• Anglais\n• SQL");
    expect(htmlToText("&lt;p&gt;Bonjour&amp;nbsp;!&lt;/p&gt;")).toBe("Bonjour !");
  });
  it("dédoublonne malgré les marqueurs H/F et la casse", () => {
    expect(dedupKey("Doctolib SAS", "Product Manager (H/F)", "Paris")).toBe(dedupKey("doctolib", "product manager", "paris"));
  });
});
