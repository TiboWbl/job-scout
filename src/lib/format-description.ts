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
