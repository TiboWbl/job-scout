// Some sources (search engines especially) hand over a posting as one block of text. Before display,
// it is given back a structure: known section titles become headings, inline dashes become lists,
// long runs of sentences become paragraphs. Well-structured texts are left as they are.

const SECTIONS = [
  "tes futures missions", "vos futures missions", "ce que tu feras", "ton futur rôle", "tes missions", "vos missions", "missions principales", "les missions", "missions", "ton rôle", "votre rôle", "le poste", "descriptif du poste", "description du poste",
  "profil recherché", "le profil que nous recherchons", "ce que nous recherchons", "ton profil", "votre profil", "le profil", "compétences requises", "compétences", "qualifications", "prérequis",
  "qui sommes-nous", "qui sommes nous", "l'entreprise", "à propos", "pourquoi nous rejoindre", "pourquoi rejoindre", "avantages", "les avantages", "les plus",
  "rémunération", "salaire", "processus de recrutement", "déroulement des entretiens", "informations complémentaires", "conditions",
  "about us", "about the company", "about the role", "the role", "your role", "your mission", "what you'll do", "what you will do", "responsibilities", "key responsibilities",
  "requirements", "your profile", "who you are", "what we're looking for", "what we are looking for", "must-haves", "must haves", "nice to have", "nice-to-have",
  "preferred experience", "qualifications", "benefits", "perks", "why join us", "why join", "what we offer", "hiring process", "recruitment process",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so "missions principales" wins over "missions".
const HEADING = new RegExp(`(^|[.!?…»"]\\s+|\\s{2,})(${[...SECTIONS].sort((a, b) => b.length - a.length).map(escape).join("|")})\\s*(?::|-|–|\\?)?\\s+`, "gi");

export function structureDescription(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim());
  // Already structured: several lines, none of them a wall of text.
  if (lines.length >= 4 && lines.every((l) => l.length < 700)) return text;

  return lines
    .map((line) => {
      let t = line;
      // Known section titles start a new line, kept as a heading ending with ":".
      t = t.replace(HEADING, (_, before: string, title: string) => `${before.trim()}\n${title.charAt(0).toUpperCase()}${title.slice(1)} :\n`);
      // Inline lists: " - item - item" or " • item • item" (at least two) become bullets.
      if ((t.match(/\s[-•·▪]\s/g) ?? []).length >= 2) t = t.replace(/\s[-•·▪]\s+/g, "\n• ");
      return t;
    })
    .join("\n")
    .split("\n")
    .flatMap((l) => {
      const line = l.trim();
      if (line.length < 500 || line.startsWith("•")) return [line];
      // A long paragraph: break it every few sentences.
      const sentences = line.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [line];
      const out: string[] = [];
      for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join("").trim());
      return out;
    })
    .filter(Boolean)
    .join("\n");
}

// The company's own introduction in the posting ("Qui sommes-nous", "About us"…), a few sentences.
const INTRO = /^(qui sommes[- ]nous|qui est [^:]{2,40}|a propos( de [^:]{2,40})?|about( us| the company| [^:]{2,30})?|l['’ ]entreprise|la soci[eé]t[eé]|notre (entreprise|soci[eé]t[eé]|histoire)|pr[eé]sentation( de [^:]{2,40})?|who we are|our (company|story|mission)|the company|company description|description de l['’ ]entreprise)\s*:?\s*$/i;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function companyIntro(description: string): string | null {
  const lines = structureDescription(description).split("\n").map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => l.length < 70 && INTRO.test(fold(l).replace(/\s*[:.?!]\s*$/, "").trim()));
  if (start < 0) return null;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // The next heading ends the introduction.
    if (line.length < 70 && /:$/.test(line)) break;
    body.push(line.replace(/^•\s*/, ""));
    if (body.join(" ").length > 420) break;
  }
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 60) return null;
  if (text.length <= 420) return text;
  const cut = text.slice(0, 420);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
