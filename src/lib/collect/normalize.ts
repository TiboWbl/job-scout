function decodeEntitiesOnce(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#39;|&rsquo;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&eacute;|&#233;/g, "é")
    .replace(/&egrave;|&#232;/g, "è")
    .replace(/&ecirc;|&#234;/g, "ê")
    .replace(/&agrave;|&#224;/g, "à")
    .replace(/&ccedil;|&#231;/g, "ç")
    .replace(/&ocirc;|&#244;/g, "ô")
    .replace(/&amp;/g, "&");
}

// HTML → readable plain text that keeps the structure the detail panel relies on:
// paragraphs on their own line, list items prefixed with "• ", headings kept as lines.
export function htmlToText(html: string): string {
  // Some sources (Greenhouse) send already-escaped markup, occasionally twice.
  const decoded = decodeEntitiesOnce(decodeEntitiesOnce(html));
  return decoded
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Inline tags sit inside words and sentences: removing them must not add a space ("discovery .").
    .replace(/<\/?(strong|b|em|i|u|span|a|code|small|sup|sub|font|mark)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "•")
    .join("\n");
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\((?:[hfmx]\s*\/\s*){1,3}[hfmx]\)|\b[hf]\s*\/\s*[hf]\b|\b(?:[mfwx]\s*\/\s*){1,3}[mfwx]\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function companyKey(name: string): string {
  return slug(name)
    .replace(/\b(sas|sa|sarl|inc|ltd|gmbh|group|groupe)\b/g, "")
    // "Robeaute-1": a suffix that career-page addresses add to tell boards apart, not a different company.
    .replace(/([a-z])\s+\d$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Same company + same normalised title + same first city = same offer, whatever the source.
export function dedupKey(company: string, title: string, firstCity: string | undefined): string {
  return [companyKey(company), slug(title), slug(firstCity ?? "na")].join("|");
}

// The key of a normalised offer. Unknown small towns fall back on the raw place, so store-by-store
// postings of the same job stay distinct.
export function offerKey(o: { company: { name: string }; title: string; places: { city?: string }[]; locationRaw: string | null }): string {
  return dedupKey(o.company.name, o.title, o.places[0]?.city ?? o.locationRaw ?? undefined);
}
