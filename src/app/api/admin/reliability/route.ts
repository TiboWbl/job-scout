import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), offerId: z.string().uuid(), level: z.string().max(20), right: z.boolean() }),
  z.object({ action: z.literal("resolve"), id: z.string().uuid() }),
]);

// The admin's spot check of the sort, or a report marked as fixed.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const db = createAdminClient();
  const { error } =
    body.data.action === "check"
      ? await db.from("sort_checks").upsert({ offer_id: body.data.offerId, user_id: auth.user.id, level: body.data.level, right_call: body.data.right, checked_at: new Date().toISOString() })
      : await db.from("offer_reports").update({ resolved_at: new Date().toISOString() }).eq("id", body.data.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
