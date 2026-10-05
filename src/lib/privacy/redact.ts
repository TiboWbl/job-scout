// Strips personal data from CV text before it is sent to any LLM. Runs server-side only.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github|behance|dribbble)\.com\/\S+|\b[\w-]+\.(?:vercel\.app|netlify\.app|github\.io)\S*/gi;
const STREET = /\b\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|all[ée]e|chemin|place|impasse|quai|route|cours|square|street|st\.|road|rd\.)\b[^\n]*/gi;
const POSTCODE_CITY = /\b\d{5}\s+[A-ZÀ-Ü][\w' -]{1,40}/g;

const PLACEHOLDERS = { email: "[email]", phone: "[téléphone]", url: "[lien]", address: "[adresse]", name: "[nom]" };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `knownNames` comes from the signed-in account (e.g. Google display name).
export function redactPersonalData(text: string, knownNames: string[] = []): string {
  let out = text
    .replace(EMAIL, PLACEHOLDERS.email)
    .replace(URL, PLACEHOLDERS.url)
    .replace(STREET, PLACEHOLDERS.address)
    .replace(POSTCODE_CITY, PLACEHOLDERS.address)
    // Phone numbers: only sequences with at least 9 digits, so years and figures survive.
    .replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 9 ? PLACEHOLDERS.phone : m));

  for (const name of knownNames.flatMap((n) => n.split(/\s+/)).filter((n) => n.length >= 2)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), PLACEHOLDERS.name);
  }

  // A CV usually opens with the person's name: drop a first line that looks like one.
  const lines = out.split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first >= 0 && /^\s*([A-ZÀ-Ü][a-zà-ÿ'-]+|[A-ZÀ-Ü'-]{2,})(\s+([A-ZÀ-Ü][a-zà-ÿ'-]+|[A-ZÀ-Ü'-]{2,})){1,2}\s*$/.test(lines[first])) {
    lines[first] = PLACEHOLDERS.name;
  }
  return lines.join("\n");
}
