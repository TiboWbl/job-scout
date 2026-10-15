// Languages an offer requires (fluent, native, C1…), read by rules, each with the sentence that says it.
// A language only wished for ("a plus", "souhaité") is not required. French and English are left to the
// person: too many profiles do not mention them to set an offer aside on them.

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// The language's French name (shown) and the words that name it, in French and English.
const NAMES: [string, string][] = [
  ["allemand", "allemand|german|deutsch"],
  ["espagnol", "espagnol|spanish|castellano"],
  ["italien", "italien|italian"],
  ["portugais", "portugais|portuguese"],
  ["néerlandais", "neerlandais|dutch|flamand|flemish"],
  ["turc", "turc|turkish"],
  ["japonais", "japonais|japanese"],
  ["chinois", "chinois|chinese|mandarin|cantonese|cantonais"],
  ["arabe", "arabe|arabic"],
  ["russe", "russe|russian"],
  ["polonais", "polonais|polish"],
  ["coréen", "coreen|korean"],
  ["indonésien", "indonesien|indonesian|bahasa"],
  ["thaï", "thai|thaï"],
  ["vietnamien", "vietnamien|vietnamese"],
  ["suédois", "suedois|swedish"],
  ["norvégien", "norvegien|norwegian"],
  ["danois", "danois|danish"],
  ["finnois", "finnois|finnish"],
  ["grec", "grec|greek"],
  ["roumain", "roumain|romanian"],
  ["tchèque", "tcheque|czech"],
  ["hongrois", "hongrois|hungarian"],
  ["hébreu", "hebreu|hebrew"],
  ["hindi", "hindi"],
  ["khmer", "khmer"],
  ["ukrainien", "ukrainien|ukrainian"],
];

const LEVEL = "fluent|fluency|fluently|native|natif|native speaker|proficient|proficiency|bilingue|bilingual|courant|couramment|c1|c2|maitrise|parfaite maitrise|mother tongue|langue maternelle";
const MUST = "required|mandatory|a must|must|essential|exige|exigee|indispensable|obligatoire|requis|requise";
const WISH = /\b(a plus|is a plus|nice to have|bonus|souhait|apprecie|serait un plus|est un plus|idealement|ideally|preferred|preferably|un atout|an asset|advantage|avantage)\b/;

const FR_EN = /\b(francais|french|anglais|english)\b/;
// "French or German": a choice. Met by any of them, so never a reason to set an offer aside when French
// or English is one; otherwise every language of the choice is kept, and one spoken is enough.
const CHOICE = /\b(or|ou)\b/;

export function requiredLanguages(text: string): { language: string; quote: string; alternatives: string[] }[] {
  const out = new Map<string, { quote: string; alternatives: string[] }>();
  const sentences = text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const s = fold(sentence);
    if (WISH.test(s)) continue;
    for (const [language, names] of NAMES) {
      if (out.has(language)) continue;
      const name = `(?:${names})`;
      const required = new RegExp(
        [
          `\\b(?:${LEVEL})\\b[^.]{0,30}\\b${name}\\b`, // fluent in Turkish, maîtrise du turc
          `\\b${name}\\b[^.]{0,25}\\b(?:${LEVEL}|${MUST})\\b`, // turc courant, Turkish (C1), Turkish is a must
          `\\b${name}[- ]speak(?:ing|er)\\b`, // Turkish-speaking
          `\\bspeak\\b[^.]{0,15}\\b${name}\\b`, // speak Turkish
          `\\bparler\\b[^.]{0,15}\\b${name}\\b`, // parler turc
        ].join("|"),
      );
      if (!required.test(s)) continue;
      const named = NAMES.filter(([, n]) => new RegExp(`\\b(?:${n})\\b`).test(s)).map(([l]) => l);
      const choice = CHOICE.test(s) && (named.length > 1 || FR_EN.test(s));
      if (choice && FR_EN.test(s)) continue;
      out.set(language, { quote: sentence.slice(0, 160), alternatives: choice ? named : [language] });
    }
  }
  return [...out].map(([language, r]) => ({ language, ...r }));
}

// The languages the person speaks, from their search or CV ("Anglais (C1)", "Turc courant"): the names
// they contain, whatever the level.
export function spokenLanguages(languages: string[]): Set<string> {
  const said = fold(languages.join(" "));
  return new Set(NAMES.filter(([, names]) => new RegExp(`\\b(?:${names})\\b`).test(said)).map(([language]) => language));
}

// The first required language the person does not speak, if any.
export function missingLanguage(text: string, languages: string[]): { language: string; quote: string } | null {
  const spoken = spokenLanguages(languages);
  const missing = requiredLanguages(text).find((r) => !r.alternatives.some((l) => spoken.has(l)));
  return missing ? { language: missing.language, quote: missing.quote } : null;
}
