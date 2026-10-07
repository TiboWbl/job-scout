// Scout's CV grid, out of 100. There is no universal ATS score: this one is transparent, each lost
// point says why and how to fix it. Pure functions, run on the server (contacts are found here by
// regex, never by the model).

export type Layout = {
  pages: number;
  // Share of text lines where text sits side by side in two separate blocks (two-column layout).
  columnRatio: number;
  // Titles written with spaced letters ("E X P É R I E N C E"), which ATS read as single letters.
  spacedTitles: number;
};

export type CvInput = { text: string; layout: Layout; filename: string; sizeBytes: number };

// `why`: why it matters, so the person can decide; nothing here is mandatory. `good`: what a passed
// point brings, so a good CV knows why it works.
export type Check = { ok: boolean; label: string; points: number; max: number; fix?: string; why?: string; good?: string };
export type Category = { key: "lisibilite" | "structure" | "contenu" | "adequation"; label: string; score: number; max: number; checks: Check[] };
export type AtsResult = { total: number; categories: Category[] };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g;
export function contactsFound(text: string) {
  const phone = (text.match(PHONE) ?? []).some((m) => m.replace(/\D/g, "").length >= 9);
  return { email: EMAIL.test(text), phone };
}

const SECTIONS: [string, RegExp][] = [
  ["Expérience", /\b(experiences?( professionnelles?)?|parcours professionnel|work experience|experience|employment)\b/],
  ["Formation", /\b(formations?|education|diplomes?|etudes|academic)\b/],
  ["Compétences", /\b(competences|skills|savoir[- ]faire|outils|hard skills|soft skills)\b/],
];
const LANGUAGES = /\b(langues?|languages?)\b/;

const ACTION_VERBS =
  /\b(pilot|lanc|concu|developp|cre|optimis|ameliore|augment|redui|gere|dirig|coordonn|mis en place|deploy|analys|automatis|negoci|conduit|realis|organis|livr|anim|defini|construi|led|launched|built|designed|developed|improved|increased|reduced|managed|delivered|created|drove|owned|shipped|implemented|analy[sz]ed)\w*/g;
// Figures that show a result: percentages, money, multipliers, counts of people or things.
const QUANTIFIED =
  /(?:[+−-]\s?)?\d+(?:[.,]\d+)?\s?(?:%|k€|m€|€|k\b|m\b|x\b|×|pts?\b|points?\b)|(?:\bx|×)\s?\d+\b|\b\d{1,3}(?:[ .,]?\d{3})*\+?\s(?:\w+\s)?(?:utilisateurs?|clients?|users?|personnes|people|entreprises|equipes?|developpeurs|devs|projets?|pays|ventes|leads|telechargements|downloads|membres|participants|collaborateurs|magasins|sites|produits|fonctionnalites|features|commandes|orders|transactions|abonnes|followers|visites|sessions|entretiens|interviews|tickets|candidats|partenaires|marches|langues|stakeholders|squads|sprints|releases|apps?)\b/gi;

function check(ok: boolean, label: string, max: number, fix: string, points = ok ? max : 0): Check {
  return { ok, label, points, max, ...(ok ? {} : { fix }) };
}

// Why each point matters: the argument behind the advice, so the person decides with full knowledge.
const WHY: [string, string][] = [
  ["Texte lisible", "Un logiciel de recrutement ne lit que le texte : ce qui est en image (scan, capture, icônes) n'existe pas pour lui, ton CV peut sortir vide de son filtre."],
  ["Une seule colonne", "Beaucoup d'ATS lisent de gauche à droite sur toute la largeur : deux colonnes se mélangent ligne à ligne, et tes expériences deviennent illisibles."],
  ["Titres de section", "L'ATS range ton CV grâce aux titres de section ; « E X P É R I E N C E » est lu comme dix lettres isolées, la section n'est pas reconnue."],
  ["Email détecté", "Sans email lisible, le recruteur qui a ton CV dans son outil ne peut pas te répondre d'un clic."],
  ["Téléphone détecté", "Un recruteur appelle souvent avant d'écrire : le numéro doit être copiable."],
  ["Deux pages", "Un recruteur passe en moyenne moins d'une minute sur un CV : l'essentiel doit tenir sur la première page."],
  ["Fichier léger", "Certains formulaires refusent les fichiers lourds, ou les compressent mal."],
  ["Nom de fichier", "Le fichier passe de boîte mail en boîte mail : « CV Prénom Nom » se retrouve, « document.pdf » se perd."],
  ["Section «", "Les ATS remplissent ton profil candidat section par section : un titre standard est reconnu à coup sûr."],
  ["Dates des expériences", "L'ATS calcule tes années d'expérience à partir des dates, et beaucoup de filtres reposent sur ce calcul."],
  ["Longueur adaptée", "Trop court, on ne voit pas ce que tu as fait ; trop long, l'essentiel se dilue."],
  ["Verbes d'action", "Un verbe d'action montre ce que tu as fait toi-même, pas seulement le contexte : c'est ce que le recruteur cherche en lisant."],
  ["Résultats chiffrés", "Un chiffre rend un résultat vérifiable et mémorable : « +30 % d'adoption » pèse plus que « amélioration de l'adoption »."],
  ["Phrases courtes", "Les recruteurs lisent en diagonale : une idée par ligne se lit, un paragraphe se saute."],
  ["Mots-clés du métier", "Les recruteurs filtrent les candidatures avec les mots des offres : les écrire tels quels, quand ils sont vrais pour toi, te rend trouvable."],
];

const GOOD: [string, string][] = [
  ["Texte lisible", "Tout ton CV est du vrai texte : un ATS en lit chaque mot."],
  ["Une seule colonne", "Une seule colonne : l'ordre de lecture d'un ATS est le tien, rien ne se mélange."],
  ["Titres de section", "Tes titres sont reconnus tels quels par les logiciels."],
  ["Email détecté", "Ton email est lisible : on peut te répondre d'un clic."],
  ["Téléphone détecté", "Ton numéro est copiable : un recruteur peut t'appeler tout de suite."],
  ["Deux pages", "Ton CV est court : l'essentiel se voit en moins d'une minute."],
  ["Section «", "Section standard : l'ATS range cette partie au bon endroit de ton profil."],
  ["Dates des expériences", "Tes dates permettent à un ATS de calculer ton expérience correctement."],
  ["Verbes d'action", "Tes missions disent ce que tu as fait, pas seulement le contexte : c'est ce qu'un recruteur cherche."],
  ["Résultats chiffrés", "Tes résultats sont chiffrés : ils restent en tête et sont vérifiables."],
  ["Phrases courtes", "Des lignes courtes : ton CV se lit en diagonale sans rien perdre."],
  ["Mots-clés du métier", "Tu emploies les mots des offres : les recherches des recruteurs te trouvent."],
];

export function scoreCv(input: CvInput, roleKeywords: { expected: string[] }): AtsResult {
  const text = input.text;
  const n = fold(text);
  const words = text.split(/\s+/).filter(Boolean).length;
  const contacts = contactsFound(text);

  // Lisibilité machine (40)
  const chars = text.replace(/\s/g, "").length;
  const extractable = chars >= 800 ? 12 : chars >= 300 ? 6 : 0;
  const columns = input.layout.columnRatio < 0.15 ? 8 : input.layout.columnRatio < 0.35 ? 4 : 0;
  const goodName = /cv|resume|curriculum/i.test(input.filename) && !/document|scan|untitled|sans titre|\(\d+\)/i.test(input.filename);
  const lisibilite: Check[] = [
    check(extractable === 12, "Texte lisible par une machine", 12, chars < 300 ? "Le PDF ne contient presque pas de texte : c'est sans doute une image. Exporte-le depuis ton traitement de texte, pas en scan ni en capture." : "Peu de texte extrait : vérifie que les parties en image (bandeau, compétences en icônes) existent aussi en texte.", extractable),
    check(columns === 8, "Une seule colonne, ordre de lecture simple", 8, "Une mise en page en colonnes mélange l'ordre de lecture pour un ATS. Passe à une colonne, ou mets la colonne latérale (compétences, langues) en fin de document.", columns),
    check(input.layout.spacedTitles === 0, "Titres de section écrits normalement", 6, "Des titres en lettres espacées (« E X P É R I E N C E ») sont lus lettre par lettre. Écris-les normalement, la mise en forme peut rester."),
    check(contacts.email, "Email détecté", 3, "Aucun email lisible : écris-le en texte, pas dans une icône ou une image."),
    check(contacts.phone, "Téléphone détecté", 3, "Aucun numéro lisible : écris-le en texte, au format 06 12 34 56 78."),
    check(input.layout.pages <= 2, "Deux pages au plus", 3, "Plus de deux pages : un recruteur lit d'abord la première. Garde l'essentiel sur une page, deux au maximum."),
    check(input.sizeBytes <= 2_000_000, "Fichier léger", 3, "Fichier de plus de 2 Mo : certains formulaires le refusent. Compresse les images ou exporte en « PDF optimisé »."),
    check(goodName, "Nom de fichier explicite", 2, "Nomme le fichier « CV Prénom Nom - Métier.pdf » plutôt que « document.pdf »."),
  ];

  // Structure (20)
  const found = SECTIONS.filter(([, re]) => re.test(n)).map(([label]) => label);
  const years = new Set(text.match(/\b(19[89]\d|20[0-4]\d)\b/g) ?? []);
  const lengthOk = words >= 250 && words <= 900;
  const structure: Check[] = [
    ...SECTIONS.map(([label]) => check(found.includes(label), `Section « ${label} » identifiable`, 4, `Ajoute un titre de section « ${label} » clair : les ATS rangent ton CV grâce à ces titres standard.`)),
    check(LANGUAGES.test(n), "Section « Langues »", 2, "Ajoute une ligne « Langues » avec ton niveau (ex. Anglais : courant, C1)."),
    check(years.size >= 2, "Dates des expériences", 3, "Date chaque expérience (mois et année de début et de fin) : sans dates, l'ATS ne calcule pas ton expérience."),
    check(lengthOk, "Longueur adaptée", 3, words < 250 ? "CV très court : détaille tes missions et résultats pour chaque expérience." : "CV très long : resserre sur les expériences les plus proches du poste visé."),
  ];

  // Contenu (25)
  const verbs = (n.match(ACTION_VERBS) ?? []).length;
  const numbers = new Set((fold(text).match(QUANTIFIED) ?? []).map((m) => m.trim())).size;
  const lines = text.split(/\n|•|·|▪/).map((l) => l.trim()).filter((l) => l.split(/\s+/).length >= 4);
  const longLines = lines.filter((l) => l.split(/\s+/).length > 35).length;
  const contenu: Check[] = [
    check(verbs >= 8, "Verbes d'action", 10, `Commence chaque mission par un verbe d'action (piloté, lancé, conçu, réduit…) : ${verbs} trouvé${verbs > 1 ? "s" : ""}, vise au moins 8.`, Math.min(10, Math.round((10 * verbs) / 8))),
    check(numbers >= 4, "Résultats chiffrés", 10, `Chiffre tes résultats (+30 % d'adoption, 2 000 utilisateurs, −15 % de churn) : ${numbers} trouvé${numbers > 1 ? "s" : ""}, vise au moins 4.`, Math.min(10, Math.round((10 * numbers) / 4))),
    check(longLines <= 2, "Phrases courtes", 5, "Certaines lignes dépassent 35 mots : coupe-les en puces d'une ligne, une idée par puce.", longLines <= 2 ? 5 : longLines <= 5 ? 2 : 0),
  ];

  // Adéquation (15): keywords of the role sought, proposed by the model, checked here in the text.
  const expected = roleKeywords.expected.slice(0, 12);
  const present = expected.filter((k) => hasKeyword(n, k));
  const missing = expected.filter((k) => !present.includes(k));
  const adequacy = expected.length ? Math.round((15 * present.length) / expected.length) : 0;
  const adequation: Check[] = [
    check(missing.length === 0 && expected.length > 0, `Mots-clés du métier visé (${present.length}/${expected.length})`, 15, `Absents de ton CV : ${missing.join(", ")}. Ajoute ceux qui correspondent vraiment à ton expérience, avec les mots exacts des offres.`, adequacy),
  ];

  const why = (label: string) => WHY.find(([start]) => label.startsWith(start))?.[1];
  const good = (label: string) => GOOD.find(([start]) => label.startsWith(start))?.[1];
  for (const c of [...lisibilite, ...structure, ...contenu, ...adequation]) {
    c.why = why(c.label);
    if (c.ok) c.good = good(c.label);
  }

  const categories: Category[] = [
    { key: "lisibilite", label: "Lisibilité machine", max: 40, checks: lisibilite, score: 0 },
    { key: "structure", label: "Structure", max: 20, checks: structure, score: 0 },
    { key: "contenu", label: "Contenu", max: 25, checks: contenu, score: 0 },
    { key: "adequation", label: "Adéquation au métier", max: 15, checks: adequation, score: 0 },
  ].map((c) => ({ ...c, score: c.checks.reduce((s, k) => s + k.points, 0) })) as Category[];
  return { total: categories.reduce((s, c) => s + c.score, 0), categories };
}

// A keyword is in the CV when each of its words is ("user research" in "research with users"); a slash
// means alternatives ("Agile/Scrum", "Jira/Confluence"): one of them is enough. Plurals count ("OKRs", "OKR").
export function hasKeyword(foldedCv: string, keyword: string) {
  const alternatives = fold(keyword).split(/\s*\/\s*/).filter(Boolean);
  return alternatives.some((alt) => {
    const words = alt.split(/[^a-z0-9+#]+/).filter((w) => w.length >= 2);
    return words.length > 0 && words.every((w) => foldedCv.includes(w.length > 3 ? w.replace(/s$/, "") : w));
  });
}

// Keywords of an offer found or missing in the CV: the comparison mode.
export function compareKeywords(cvText: string, keywords: string[]) {
  const n = fold(cvText);
  const present = keywords.filter((k) => hasKeyword(n, k));
  return { present, missing: keywords.filter((k) => !present.includes(k)), score: keywords.length ? Math.round((100 * present.length) / keywords.length) : 0 };
}
