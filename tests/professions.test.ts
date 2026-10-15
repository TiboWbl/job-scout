// Scout must work the same for any job, not only the two first users' (product manager, video editor).
// Each profile below is fictional; each offer is a short synthetic posting built around a known trap:
// a word shared with another job (bike "monteur", "Product Designer", "Business Developer"), a training
// course, a partial title confirmed by the text. Checked for every job: which offers reach the model,
// which count in the market, which reasons are inventions, and which tools a CV really names.
import { describe, expect, it } from "vitest";
import { Criteria } from "@/lib/domain/criteria";
import { inventedRoleWords, isTraining, namesRole, titleRelevance } from "@/lib/scoring/relevance";
import { cvSkillsFrom } from "@/lib/views/skills";

type Case = { title: string; text: string; candidate: boolean; market: boolean };
type Profile = { job: string; criteria: Criteria; offers: Case[]; invented?: { title: string; text: string; why: string }; cv?: { text: string; vocabulary: string[]; found: string[] } };

const lorem = (topic: string) => `${topic} `.repeat(3) + "Tu rejoins une équipe bienveillante, en CDI, avec des responsabilités dès ton arrivée.";

const PROFILES: Profile[] = [
  {
    job: "monteur vidéo",
    criteria: Criteria.parse({ targetRoles: ["Monteur vidéo"], titleVariants: ["Video Editor", "Motion Designer"], bridgeRoles: ["Graphiste"] }),
    offers: [
      { title: "Monteur vidéo junior (H/F)", text: lorem("Tu montes nos vidéos YouTube et nos formats courts."), candidate: true, market: true },
      { title: "Video Editor - Social Media", text: lorem("You edit short videos for our social accounts."), candidate: true, market: true },
      { title: "Monteur.euse Cycle (H/F)", text: lorem("Tu montes et répares les vélos de nos clients en atelier."), candidate: true, market: false },
      { title: "Product Designer", text: lorem("Tu conçois les parcours de notre application avec Figma."), candidate: true, market: false },
      { title: "Comptable fournisseurs", text: lorem("Tu tiens la comptabilité fournisseurs."), candidate: false, market: false },
    ],
    invented: { title: "Monteur.euse Cycle (H/F)", text: "Tu montes et répares les vélos de nos clients en atelier.", why: "Poste de monteur vidéo en CDD dans le sport." },
    cv: { text: "Montage sur Premiere Pro et After Effects, maquettes sur Figma, retouche avec la suite Adobe.", vocabulary: ["Premiere Pro", "After Effects", "Figma", "Adobe", "Redis", "SQL"], found: ["Premiere Pro", "After Effects", "Figma", "Adobe"] },
  },
  {
    job: "graphiste",
    criteria: Criteria.parse({ targetRoles: ["Graphiste"], titleVariants: ["Graphic Designer", "Designer graphique"] }),
    offers: [
      { title: "Graphiste PAO (H/F)", text: lorem("Tu crées nos supports print et digitaux."), candidate: true, market: true },
      { title: "Graphic Designer", text: lorem("You design our brand assets."), candidate: true, market: true },
      { title: "UX Designer", text: lorem("Tu mènes des tests utilisateurs et dessines des parcours."), candidate: true, market: false },
    ],
  },
  {
    job: "product manager",
    criteria: Criteria.parse({ targetRoles: ["Product Manager"], titleVariants: ["Product Owner", "Chef de projet digital"] }),
    offers: [
      { title: "Senior Product Manager", text: lorem("Tu pilotes la roadmap."), candidate: true, market: true },
      { title: "Chef de projet (H/F)", text: lorem("Tu pilotes nos projets digital et produit avec les équipes tech."), candidate: true, market: true },
      { title: "Chef de projet travaux (H/F)", text: lorem("Tu suis nos chantiers de construction et les corps de métier."), candidate: true, market: false },
      { title: "Product Engineer", text: lorem("Tu développes nos fonctionnalités en TypeScript."), candidate: true, market: false },
    ],
  },
  {
    job: "développeur web",
    criteria: Criteria.parse({ targetRoles: ["Développeur web"], titleVariants: ["Web Developer", "Développeur front-end"] }),
    offers: [
      { title: "Développeur web full stack", text: lorem("Tu développes nos applications."), candidate: true, market: true },
      { title: "Web Developer (React)", text: lorem("You build our web app."), candidate: true, market: true },
      { title: "Business Developer", text: lorem("Tu prospectes de nouveaux clients."), candidate: false, market: false },
    ],
  },
  {
    job: "infirmier",
    criteria: Criteria.parse({ targetRoles: ["Infirmier"], titleVariants: ["Infirmière", "IDE"] }),
    offers: [
      { title: "Infirmier diplômé d'État (H/F)", text: lorem("Tu assures les soins des patients."), candidate: true, market: true },
      { title: "Formation infirmier : préparation au concours", text: lorem("Prépare le concours d'entrée en IFSI."), candidate: true, market: true },
      { title: "Aide-soignant (H/F)", text: lorem("Tu accompagnes les patients au quotidien."), candidate: false, market: false },
    ],
  },
  {
    job: "comptable",
    criteria: Criteria.parse({ targetRoles: ["Comptable"], titleVariants: ["Comptable général", "Accountant"] }),
    offers: [
      { title: "Comptable fournisseurs (H/F)", text: lorem("Tu tiens la comptabilité fournisseurs."), candidate: true, market: true },
      { title: "Accountant - Paris", text: lorem("You handle month-end closing."), candidate: true, market: true },
      { title: "Contrôleur de gestion", text: lorem("Tu construis le budget."), candidate: false, market: false },
    ],
  },
  {
    job: "commercial",
    criteria: Criteria.parse({ targetRoles: ["Business Developer"], titleVariants: ["Commercial B2B", "Account Executive"] }),
    offers: [
      { title: "Business Developer SaaS", text: lorem("Tu prospectes et signes de nouveaux clients."), candidate: true, market: true },
      { title: "Account Executive Mid-Market", text: lorem("You close new deals."), candidate: true, market: true },
      { title: "Développeur back-end", text: lorem("Tu développes notre API."), candidate: false, market: false },
    ],
  },
];

describe.each(PROFILES)("métier : $job", ({ criteria, offers, invented, cv }) => {
  it.each(offers)("« $title » : lue par l'IA = $candidate, dans le marché = $market", ({ title, text, candidate, market }) => {
    expect(titleRelevance(title, criteria) >= 5).toBe(candidate);
    expect(namesRole(title, text, { ...criteria, bridgeRoles: [] })).toBe(market);
  });
  if (invented)
    it("une raison qui invente le métier est repérée", () => {
      expect(inventedRoleWords(invented.why, invented.title, invented.text, criteria).length).toBeGreaterThan(0);
    });
  if (cv)
    it("les outils du CV sont lus tels qu'écrits, sans faux positif", () => {
      expect(cvSkillsFrom(cv.text, cv.vocabulary).sort()).toEqual([...cv.found].sort());
    });
});

describe("formations, pour tous les métiers", () => {
  it.each(["Formation infirmier : préparation au concours", "Formation Monteur audiovisuel - Paris", "Bootcamp Développeur web", "Formation certifiante en comptabilité"])("« %s » n'est pas une offre d'emploi", (title) => {
    expect(isTraining(title)).toBe(true);
  });
  it.each(["Chargé de formation (H/F)", "Responsable formation", "Développeur web"])("« %s » en est une", (title) => {
    expect(isTraining(title)).toBe(false);
  });
});
