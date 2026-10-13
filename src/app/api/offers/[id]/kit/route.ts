import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { writeKit } from "@/lib/prep";

export const maxDuration = 60;

const Body = z.object({ part: z.enum(["message", "letter"]).default("message") });

// What to send when applying: a short message, and the cover letter when the offer asks for one.
// Each is prepared on demand (one model call), kept with the person's score for the next opening.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { part } = Body.parse(await request.json().catch(() => ({})));
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from("profiles").select("criteria, criteria_version, cv_summary").eq("id", user.id).single();
  const version = profile?.criteria_version ?? 0;
  const { data: score } = await supabase.from("offer_scores").select("kit").eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version).maybeSingle();
  const kit = (score?.kit ?? {}) as { message?: string; letter?: string };
  if (kit[part]) return NextResponse.json(kit);
  const { data: offer } = await supabase.from("offers").select("title, description, company:companies(name)").eq("id", id).single();
  if (!offer?.description) return NextResponse.json({ error: "L'annonce complète n'a pas pu être lue : prépare-toi depuis son site." }, { status: 404 });
  try {
    const text = await writeKit(getLlm(), profile, { title: offer.title, company: (offer.company as unknown as { name: string } | null)?.name ?? "", description: offer.description }, part);
    if (!text) return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
    const next = { ...kit, [part]: text };
    if (score) await supabase.from("offer_scores").update({ kit: next }).eq("user_id", user.id).eq("offer_id", id).eq("criteria_version", version);
    return NextResponse.json(next);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
  }
}
