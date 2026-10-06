import { NextResponse } from "next/server";
import { getDemoUserId } from "@/lib/demo";
import { SCORE_SELECT } from "@/lib/domain/feed";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = 100;

// Read-only: the demo persona's set-aside offers, a page at a time.
export async function GET(request: Request) {
  const from = Math.max(0, Number(new URL(request.url).searchParams.get("from")) || 0);
  const db = createAdminClient();
  const userId = await getDemoUserId(db);
  if (!userId) return NextResponse.json({ data: [] });
  const { data } = await db
    .from("offer_scores")
    .select(SCORE_SELECT)
    .eq("user_id", userId)
    .eq("level", "ecartee")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE - 1);
  return NextResponse.json({ data: data ?? [] });
}
