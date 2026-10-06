import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { LLM_UNAVAILABLE_MESSAGE, LlmUnavailableError } from "@/lib/llm";
import { runScoring } from "@/lib/scoring/engine";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Hobby caps a function at 60 s: each call scores what fits in ~45 s and reports what is left,
// the client calls again until nothing remains.
export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const progress = await runScoring(auth.supabase, auth.user.id, 45_000, createAdminClient());
    return NextResponse.json(progress);
  } catch (error) {
    if (error instanceof LlmUnavailableError) return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE, retry: true }, { status: 503 });
    return NextResponse.json({ error: "Le classement a échoué, réessaie dans un instant." }, { status: 500 });
  }
}
