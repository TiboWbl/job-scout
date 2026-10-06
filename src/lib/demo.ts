import type { SupabaseClient } from "@supabase/supabase-js";
import { Criteria } from "@/lib/domain/criteria";

// Public demo: Camille, a fictional junior PM in Paris. Her profile is scored by the scheduled job on
// the real offers, like anyone's; visitors only read. Nothing here is about a real person.

const DEMO_EMAIL = "camille.demo@scout.invalid";

export const DEMO_CRITERIA = Criteria.parse({
  targetRoles: ["Product Manager"],
  titleVariants: ["Junior Product Manager", "Associate Product Manager", "Chef de produit digital", "Product Owner"],
  bridgeRoles: ["Product Analyst", "UX Researcher"],
  sectorsPriority: ["Santé", "Mobilité", "Éducation"],
  sectorsAvoid: ["Jeux d'argent"],
  otherSectors: { open: true, condition: "une équipe produit structurée" },
  zone: { places: [{ label: "Paris", kind: "city", country: "FR" }, { label: "Île-de-France", kind: "region", country: "FR" }], remoteOk: true },
  outOfZone: "never",
  contracts: ["cdi"],
  experienceYears: 1,
  languages: ["Français", "Anglais courant"],
  availability: "immédiate",
  openness: 60,
});

const DEMO_SEARCH = "Je cherche un premier CDI de Product Manager à Paris, idéalement dans la santé, la mobilité ou l'éducation. J'ai un an d'expérience en stage de Product Owner.";
const DEMO_CV = {
  experienceYears: 1,
  roles: ["Product Owner, stage de 6 mois en scale-up", "Analyste produit, stage de 6 mois"],
  skills: ["Discovery", "Priorisation", "User stories", "SQL", "Figma", "Interviews utilisateurs"],
  languages: ["Français", "Anglais C1"],
  education: ["Master en management de l'innovation"],
  highlights: ["Refonte d'un parcours d'inscription (+12 % de conversion)"],
};

export async function getDemoUserId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("profiles").select("id").eq("is_demo", true).maybeSingle();
  return data?.id ?? null;
}

// Creates Camille if needed (no password, an address nobody can receive: she can never sign in).
export async function ensureDemoProfile(db: SupabaseClient): Promise<string> {
  const existing = await getDemoUserId(db);
  if (existing) return existing;
  const { data, error } = await db.auth.admin.createUser({ email: DEMO_EMAIL, email_confirm: true, user_metadata: { given_name: "Camille" } });
  if (error) throw error;
  const id = data.user!.id;
  await db
    .from("profiles")
    .update({ is_demo: true, display_name: "Camille", criteria: DEMO_CRITERIA, criteria_version: 1, search_text: DEMO_SEARCH, cv_summary: DEMO_CV, cv_filename: "cv-camille.pdf", cv_updated_at: new Date().toISOString(), onboarded_at: new Date().toISOString() })
    .eq("id", id);
  return id;
}

const DAY = 86_400_000;
const NOTES = [
  "Échange très agréable avec l'équipe produit.",
  "Candidature envoyée avec une lettre courte.",
  "Prévoir un cas pratique sur la priorisation.",
  "Offre repérée par Scout, à préparer ce week-end.",
  "Réponse négative, retour constructif sur l'expérience.",
];

// Rebuilt every day on offers still open, with dates relative to today, so the demo always looks alive.
export async function seedDemoApplications(db: SupabaseClient, userId: string) {
  const { data: scores } = await db
    .from("offer_scores")
    .select("level, offer:offers(id, title, apply_url, archived_at, company:companies(name))")
    .eq("user_id", userId)
    .neq("level", "ecartee")
    .limit(60);
  type Row = { offer: { id: string; title: string; apply_url: string; archived_at: string | null; company: { name: string } | null } | null };
  const offers = ((scores ?? []) as unknown as Row[]).map((r) => r.offer).filter((o): o is NonNullable<Row["offer"]> => Boolean(o && !o.archived_at));
  await db.from("applications").delete().eq("user_id", userId);
  const now = Date.now();
  const plan = [
    { stage: "entretien", applied: 12, interview: 3, followed: null },
    { stage: "postule", applied: 9, interview: null, followed: null },
    { stage: "postule", applied: 2, interview: null, followed: null },
    { stage: "a_postuler", applied: null, interview: null, followed: null },
    { stage: "refuse", applied: 20, interview: null, followed: 12 },
  ] as const;
  // Spread over the list, never the same offer twice.
  const picks = [...new Set(plan.map((_, i) => Math.min(i * 3, offers.length - 1)))].map((i) => offers[i]).filter(Boolean);
  const rows = plan.slice(0, picks.length).map((p, i) => {
    const o = picks[i];
    return {
      user_id: userId,
      offer_id: o.id,
      title: o.title,
      company: o.company?.name ?? "",
      url: o.apply_url,
      stage: p.stage,
      applied_at: p.applied === null ? null : new Date(now - p.applied * DAY).toISOString(),
      interview_at: p.interview === null ? null : new Date(new Date(now + p.interview * DAY).setHours(14, 30, 0, 0)).toISOString(),
      followed_up_at: p.followed === null ? null : new Date(now - p.followed * DAY).toISOString(),
      notes: NOTES[i],
      contact: i === 0 ? "Équipe recrutement" : "",
      origin: "scout",
      updated_at: new Date(now - i * 3600_000).toISOString(),
    };
  });
  if (rows.length > 0) await db.from("applications").insert(rows);
  return rows.length;
}
