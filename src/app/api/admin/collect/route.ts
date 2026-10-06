import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { runCollection } from "@/lib/collect/run";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Manual trigger until the scheduled GitHub Action exists. Admin = ADMIN_EMAIL, never hardcoded.
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    // Fits a serverless call: the boards least recently read go first, the rest wait for the next run.
    const reports = await runCollection(createAdminClient(), { budgetMs: 45_000 });
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message.slice(0, 200) }, { status: 500 });
  }
}
