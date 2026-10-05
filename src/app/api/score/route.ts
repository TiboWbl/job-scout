import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { runScoring } from "@/lib/scoring/engine";

// Vercel Hobby caps a function at 60 s: each call scores what fits in ~45 s and reports what is left,
// the client calls again until nothing remains.
export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const progress = await runScoring(auth.supabase, auth.user.id, 45_000);
    return NextResponse.json(progress);
  } catch {
    return NextResponse.json({ error: "Le classement a échoué, réessaie dans un instant." }, { status: 500 });
  }
}
