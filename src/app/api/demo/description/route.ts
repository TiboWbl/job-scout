import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Read-only: an offer's description (shared, public postings) for the demo's detail view.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ description: "" });
  const { data } = await createAdminClient().from("offers").select("description").eq("id", id).maybeSingle();
  return NextResponse.json({ description: data?.description ?? "" });
}
