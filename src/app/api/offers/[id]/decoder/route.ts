import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;

// How long this company's offers stay online once published: the median over the offers Scout saw
// close. Public facts about public postings, so the demo can show it too. Nothing below 5 offers.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ medianDays: null });
  const db = createAdminClient();
  const { data: offer } = await db.from("offers").select("company_id").eq("id", id).maybeSingle();
  if (!offer) return NextResponse.json({ medianDays: null });
  const { data } = await db.from("offers").select("published_at, archived_at").eq("company_id", offer.company_id).not("archived_at", "is", null).not("published_at", "is", null).limit(500);
  const days = (data ?? [])
    .map((o) => (Date.parse(o.archived_at as string) - Date.parse(o.published_at as string)) / DAY)
    .filter((d) => d >= 1 && d <= 365)
    .sort((a, b) => a - b);
  const medianDays = days.length >= 5 ? Math.round(days[Math.floor(days.length / 2)]) : null;
  return NextResponse.json({ medianDays, closed: days.length }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
