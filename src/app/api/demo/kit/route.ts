import { NextResponse } from "next/server";
import { getDemoUserId } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

// Read-only: the application kit prepared for the demo persona on one offer, if any.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("offre");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({});
  const db = createAdminClient();
  const userId = await getDemoUserId(db);
  if (!userId) return NextResponse.json({});
  const { data } = await db.from("offer_scores").select("kit").eq("user_id", userId).eq("offer_id", id).not("kit", "is", null).limit(1).maybeSingle();
  return NextResponse.json(data?.kit ?? {});
}
