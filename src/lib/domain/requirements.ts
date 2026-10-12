// What an offer requires and what it only wishes for. A "nice to have" section ("Un plus", "Idéalement",
// "Bonus") or a line that says so ("SQL serait un plus") is a wish; everything else counts as asked.
// Read by rules, never guessed: when the offer makes no difference, everything is required.

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const BONUS = /\b(un plus|en plus|serait (un )?(plus|apprecie|appreciee|bienvenu)|est un plus|appreci|bonus|nice[- ]to[- ]have|ideal(ement)?|atouts?|optionnel|souhaite|souhaitable|preferred|is a plus|would be a plus|a plus\b|pluses|ce qui ferait la difference|points? forts?)/;
const SECTION = /\b(profil|missions?|responsabilit|pourquoi|avantages|process|qui sommes|a propos|about|benefits|ce que|tu es|vous etes|requirements|qualifications|competences|stack|environnement|conditions|infos|plus|nice|bonus|ideal)/;
// A heading: a short line that ends with a colon, or names a usual section. A short item line
// ("Python") is not one, so it never closes the section it belongs to.
const isHeading = (line: string, n: string) => line.split(/\s+/).length <= 9 && !/^[•\-*·]/.test(line) && (/[:：]\s*$/.test(line) || (!/[.!,;]$/.test(line) && SECTION.test(n)));

export function splitRequirements(description: string): { required: string; bonus: string } {
  const required: string[] = [];
  const bonus: string[] = [];
  let inBonus = false;
  for (const raw of description.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const n = fold(line);
    if (isHeading(line, n)) {
      inBonus = BONUS.test(n) || /\bplus\b/.test(n);
      // The heading itself holds no skill worth counting either way.
      (inBonus ? bonus : required).push(line);
      continue;
    }
    if (inBonus || BONUS.test(n)) bonus.push(line);
    else required.push(line);
  }
  return { required: required.join("\n"), bonus: bonus.join("\n") };
}
