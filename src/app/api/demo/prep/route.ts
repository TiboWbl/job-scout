import { NextResponse } from "next/server";
import { getDemoUserId } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

// Read-only: the interview preparation of one of the demo persona's applications, if any.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("candidature");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({});
  const db = createAdminClient();
  const userId = await getDemoUserId(db);
  if (!userId) return NextResponse.json({});
  const { data } = await db.from("applications").select("prep").eq("user_id", userId).eq("id", id).maybeSingle();
  return NextResponse.json(data?.prep ?? {});
}
