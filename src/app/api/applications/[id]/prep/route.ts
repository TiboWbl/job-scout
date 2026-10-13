import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getLlm, LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { writePrep } from "@/lib/prep";

export const maxDuration = 60;

// Once the interview is obtained: the self-introduction and the questions to prepare, on demand.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { supabase, user } = auth;
  const { data: app } = await supabase.from("applications").select("title, company, offer_id, prep").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Candidature introuvable." }, { status: 404 });
  if (app.prep) return NextResponse.json(app.prep);
  const [{ data: profile }, { data: offer }] = await Promise.all([
    supabase.from("profiles").select("criteria, cv_summary").eq("id", user.id).single(),
    app.offer_id ? supabase.from("offers").select("description").eq("id", app.offer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  try {
    const prep = await writePrep(getLlm(), profile, { title: app.title, company: app.company, description: offer?.description ?? null });
    if (!prep.presentation) return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
    await supabase.from("applications").update({ prep }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json(prep);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "La préparation n'a pas abouti, réessaie." }, { status: 500 });
  }
}
