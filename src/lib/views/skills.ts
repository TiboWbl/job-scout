import type { Skill } from "@/lib/scoring/judge";

export type SkillStat = { name: string; kind: Skill["kind"]; count: number; share: number; inCv: boolean };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
// "Roadmaps" and "roadmap", "A/B tests" and "A/B test" are the same skill.
const key = (s: string) => fold(s).split(" ").map((w) => (w.length > 3 ? w.replace(/s$/, "") : w)).join(" ");
const QUALIFIERS = new Set(["produit", "product", "digital", "digitale", "professionnel", "professionnelle", "courant", "avance", "avancee", "solide", "efficace", "agile", "client", "utilisateur", "user", "management", "skill"]);
// Same skill, other spelling.
const ALIASES: Record<string, string> = { ai: "ia", "intelligence artificielle": "ia", "artificial intelligence": "ia", kpi: "kpi", okrs: "okr" };

// A language is its name, whatever the level written ("anglais courant", "English").
const LANGUAGES: [RegExp, string][] = [
  [/\b(anglais|english)\b/, "Anglais"],
  [/\b(francais|french)\b/, "Français"],
  [/\b(espagnol|spanish)\b/, "Espagnol"],
  [/\b(allemand|german)\b/, "Allemand"],
  [/\b(italien|italian)\b/, "Italien"],
];

// What the offers of a selection ask for most, and whether the CV already says it.
export function topSkills(offers: { skills: Skill[] | null }[], cvText: string, perKind = 8, cvSkills: string[] = []): { read: number; byKind: Record<Skill["kind"], SkillStat[]> } {
  const read = offers.filter((o) => o.skills && o.skills.length > 0);
  const groups = new Map<string, { names: Map<string, number>; kind: Skill["kind"]; offers: Set<number> }>();
  read.forEach((o, index) => {
    for (const s of o.skills!) {
      const language = s.kind === "langue" ? LANGUAGES.find(([re]) => re.test(fold(s.name))) : undefined;
      const name = language ? language[1] : s.name;
      const k = ALIASES[key(name)] ?? key(name);
      if (!k) continue;
      const g = groups.get(k) ?? { names: new Map(), kind: s.kind, offers: new Set<number>() };
      g.offers.add(index);
      g.names.set(name, (g.names.get(name) ?? 0) + 1);
      groups.set(k, g);
    }
  });
  // "roadmap produit" joins "roadmap": the same skill with only a qualifier added. "data analysis" stays itself.
  const keys = [...groups.keys()].sort((a, b) => a.length - b.length);
  for (const long of keys) {
    const base = keys.find(
      (short) =>
        short !== long &&
        long.startsWith(`${short} `) &&
        long.slice(short.length + 1).split(" ").every((w) => QUALIFIERS.has(w)) &&
        groups.get(short)?.kind === groups.get(long)?.kind,
    );
    if (!base) continue;
    const from = groups.get(long)!;
    const to = groups.get(base)!;
    for (const i of from.offers) to.offers.add(i);
    groups.delete(long);
  }
  const cv = ` ${key(cvText)} `;
  const fromCv = new Set(cvSkills.map((n) => ALIASES[key(n)] ?? key(n)));
  const byKind: Record<Skill["kind"], SkillStat[]> = { outil: [], methode: [], savoir_etre: [], langue: [] };
  for (const [k, g] of groups) {
    // The spelling used most often is shown.
    const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const count = g.offers.size;
    byKind[g.kind].push({ name, kind: g.kind, count, share: Math.round((100 * count) / Math.max(1, read.length)), inCv: fromCv.has(k) || k.split(" ").every((w) => cv.includes(` ${w}`)) });
  }
  for (const kind of Object.keys(byKind) as Skill["kind"][]) byKind[kind] = byKind[kind].filter((s) => s.count >= 2).sort((a, b) => b.count - a.count).slice(0, perKind);
  return { read: read.length, byKind };
}

// The skills (from Scout's list of skills asked by offers) that a CV mentions: kept instead of the CV.
export function cvSkillsFrom(cvText: string, names: string[]): string[] {
  const text = ` ${key(cvText)} `;
  const out = new Map<string, string>();
  for (const name of names) {
    const k = ALIASES[key(name)] ?? key(name);
    if (!k || out.has(k)) continue;
    if (k.split(" ").every((w) => text.includes(` ${w}`))) out.set(k, name);
  }
  return [...out.values()];
}
