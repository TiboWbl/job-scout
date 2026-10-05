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
    const reports = await runCollection(createAdminClient());
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message.slice(0, 200) }, { status: 500 });
  }
}
