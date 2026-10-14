import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { isDispatchConfigured, requestCollection } from "@/lib/collect/dispatch";
import { runCollection } from "@/lib/collect/run";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Starts the full scheduled job now (collection, sort, market, email) on GitHub Actions. Without the
// dispatch token, a short collection runs here instead (the boards least recently read first).
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (isDispatchConfigured()) {
    const started = await requestCollection();
    return started ? NextResponse.json({ dispatched: true }) : NextResponse.json({ error: "GitHub n'a pas accepté la demande, réessaie dans un instant." }, { status: 502 });
  }
  try {
    const reports = await runCollection(createAdminClient(), { budgetMs: 45_000 });
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message.slice(0, 200) }, { status: 500 });
  }
}
