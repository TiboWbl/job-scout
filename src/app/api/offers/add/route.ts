import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { fromText, fromUrl } from "@/lib/collect/manual";
import { offerKey } from "@/lib/collect/normalize";
import { resolveCompany } from "@/lib/collect/resolve";
import { upsertOffers } from "@/lib/collect/run";
import { LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { scoreOffersNow } from "@/lib/scoring/engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const Body = z.object({
  url: z.string().trim().url().max(2000).optional(),
  text: z.string().trim().max(30_000).optional(),
  applied: z.boolean().default(false),
});

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// An offer found elsewhere joins Scout: read, compared with what Scout already knew, judged for this
// person, added to their tracking. The diagnostic measures and improves Scout's coverage.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || (!body.data.url && !body.data.text)) return badRequest("Colle l'adresse de l'offre, ou son texte.");
  const { url, text, applied } = body.data;
  const admin = createAdminClient();

  try {
    // 1. Already known by its address?
    let offerId: string | null = null;
    let known: { first_seen_at: string } | null = null;
    if (url) {
      const { data } = await admin.from("offers").select("id, first_seen_at").eq("apply_url", url).limit(1).maybeSingle();
      const viaUrls = data ? null : (await admin.from("offers").select("id, first_seen_at").contains("urls", [{ url }]).limit(1).maybeSingle()).data;
      const hit = data ?? viaUrls;
      if (hit) [offerId, known] = [hit.id, hit];
    }

    // 2. Otherwise read it, then look for the same offer under another source.
    if (!offerId) {
      const posting = text ? await fromText(text, url ?? null) : await fromUrl(url!);
      if (!posting) return NextResponse.json({ needText: true });
      const key = offerKey(posting);
      const { data: same } = await admin.from("offers").select("id, first_seen_at").eq("dedup_key", key).maybeSingle();
      if (same) [offerId, known] = [same.id, same];
      else {
        await upsertOffers(admin, [posting]);
        const { data: inserted } = await admin.from("offers").select("id, company:companies(name, ats, ats_checked_at)").eq("dedup_key", key).single();
        offerId = inserted!.id;
        // Unknown employer: find its career page so Scout catches its next offers by itself.
        const company = inserted!.company as unknown as { name: string; ats: string | null; ats_checked_at: string | null } | null;
        if (company && !company.ats && !company.ats_checked_at && !/non communiqu/i.test(company.name)) await resolveCompany(admin, company.name).catch(() => null);
      }
    }

    // 3. Judged for this person (also when known: their score may predate a profile change).
    const { data: previous } = await auth.supabase.from("offer_scores").select("level, excluded_reason").eq("offer_id", offerId).maybeSingle();
    const [score] = (await scoreOffersNow(auth.supabase, auth.user.id, [offerId!])) as { level: string; excluded_reason: string | null; why?: string }[];

    // 4. Into the tracking.
    const { data: offer } = await admin.from("offers").select("title, apply_url, company:companies(name)").eq("id", offerId).single();
    const companyName = (offer?.company as unknown as { name: string } | null)?.name ?? "";
    await auth.supabase.from("applications").upsert(
      {
        user_id: auth.user.id,
        offer_id: offerId,
        title: offer?.title ?? "Offre",
        company: companyName,
        url: url ?? offer?.apply_url ?? null,
        stage: applied ? "postule" : "a_postuler",
        applied_at: applied ? new Date().toISOString() : null,
        origin: "added",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,offer_id" },
    );

    const diagnostic = !known
      ? { kind: "new", text: "Nouvelle pour Scout : il ne l'avait pas encore trouvée." }
      : previous?.level === "ecartee"
        ? { kind: "excluded", text: `Scout l'avait trouvée le ${day(known.first_seen_at)}, mais écartée : ${previous.excluded_reason ?? "règle de ta recherche"}` }
        : { kind: "known", text: `Déjà trouvée par Scout le ${day(known.first_seen_at)}.` };
    return NextResponse.json({ diagnostic, title: offer?.title, company: companyName, level: score?.level ?? null, why: score?.why ?? score?.excluded_reason ?? null });
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    console.error("add offer failed:", (error as Error).name);
    return NextResponse.json({ error: "L'ajout n'a pas abouti. Réessaie, ou colle le texte de l'offre." }, { status: 500 });
  }
}
