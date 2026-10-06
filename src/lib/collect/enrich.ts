import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getLlm } from "@/lib/llm";

// Who really recruits behind an employer name: a subsidiary's group, a public body's institution.
// The model proposes a brand and an official domain; a domain is kept only if the logo CDN knows it.

const BATCH = 25;
const SYSTEM = `Tu aides à identifier les employeurs d'offres d'emploi. Pour chaque employeur, tu reçois son nom tel qu'il apparaît et quelques intitulés de ses offres.
Réponds uniquement avec {"employeurs": [{"id", "marque", "domaine"}]} :
- "marque" : le nom court, sans parenthèse, de la marque ou du groupe le plus connu qui recrute réellement (une filiale → son groupe ; une agence ou entité d'un groupe → le groupe ; une administration ou un établissement public → l'institution principale), sinon le nom lui-même.
- "domaine" : le domaine du site officiel de cette marque (ex. "theodo.com"), seulement si tu le connais avec certitude, sinon null. N'invente jamais.`;

const Answer = z.object({
  employeurs: z.array(z.object({ id: z.union([z.string(), z.number()]).transform(String), marque: z.string().nullish(), domaine: z.string().nullish() })),
});

async function logoExists(domain: string): Promise<boolean> {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://img.logo.dev/${domain}?token=${token}&size=32&fallback=404`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  return res?.ok ?? false;
}

const cleanDomain = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

export async function enrichCompanies(db: SupabaseClient, limit = 200): Promise<{ checked: number; withDomain: number }> {
  const { data: companies } = await db.from("companies").select("id, name").is("domain", null).is("enriched_at", null).limit(limit);
  let withDomain = 0;
  for (let i = 0; i < (companies ?? []).length; i += BATCH) {
    const batch = companies!.slice(i, i + BATCH);
    // A few postings per employer: titles for the model, full text as evidence for any brand it names.
    const titles = new Map<string, string[]>();
    const evidence = new Map<string, string>();
    await Promise.all(
      batch.map(async (c) => {
        const { data: offers } = await db.from("offers").select("title, description").eq("company_id", c.id).limit(3);
        titles.set(c.id, (offers ?? []).map((o) => o.title).slice(0, 2));
        evidence.set(c.id, (offers ?? []).map((o) => `${o.title}\n${(o.description ?? "").slice(0, 4000)}`).join("\n").toLowerCase());
      }),
    );
    const user = batch.map((c, k) => JSON.stringify({ id: `e${k + 1}`, nom: c.name, offres: titles.get(c.id) ?? [] })).join("\n");
    let answer: z.infer<typeof Answer> | null = null;
    try {
      const parsed = Answer.safeParse(await getLlm().json({ system: SYSTEM, user, tier: "fast" }));
      answer = parsed.success ? parsed.data : null;
    } catch {
      return { checked: i, withDomain };
    }
    for (const [k, c] of batch.entries()) {
      const a = answer?.employeurs.find((e) => e.id === `e${k + 1}` || e.id === String(k + 1));
      // "Deloitte (filiale …)" → "Deloitte"; a brand that only re-spells the name is not a different recruiter.
      const proposed = a?.marque?.replace(/\s*\(.*?\)\s*/g, " ").trim() || null;
      const same = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isSelf = !proposed || same(proposed) === same(c.name);
      // Only a brand the postings themselves mention: a wrong group shown to the user is worse than none.
      const mentioned = Boolean(proposed && evidence.get(c.id)?.includes(proposed.toLowerCase()));
      const brand = proposed && mentioned && !isSelf ? proposed : null;
      // The domain must belong to the employer itself or to a brand the postings mention.
      const domain = a?.domaine ? cleanDomain(a.domaine) : null;
      const verified = domain && (isSelf || brand) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) && (await logoExists(domain)) ? domain : null;
      if (verified) withDomain++;
      // A new domain means a new logo: its colour is extracted again.
      await db
        .from("companies")
        .update({ brand, enriched_at: new Date().toISOString(), ...(verified ? { domain: verified, color_checked_at: null } : {}) })
        .eq("id", c.id);
    }
  }
  return { checked: companies?.length ?? 0, withDomain };
}
