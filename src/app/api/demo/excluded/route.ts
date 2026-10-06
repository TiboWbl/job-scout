import { NextResponse } from "next/server";
import { getDemoUserId } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadExcludedPage } from "@/lib/views/excluded";

// Read-only: the demo persona's set-aside offers, a page at a time, optionally searched.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = Math.max(0, Number(params.get("from")) || 0);
  const search = (params.get("q") ?? "").slice(0, 80);
  const db = createAdminClient();
  const userId = await getDemoUserId(db);
  if (!userId) return NextResponse.json({ data: [] });
  return NextResponse.json({ data: await loadExcludedPage(db, { userId, from, search }) });
}
