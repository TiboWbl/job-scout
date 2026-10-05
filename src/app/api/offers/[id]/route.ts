import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";

const Body = z.object({
  saved: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  reason: z.string().max(80).nullable().optional(),
});

// Save / "pas pour moi" on one offer, for the signed-in user only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Requête invalide");

  const row: Record<string, unknown> = { user_id: auth.user.id, offer_id: id, updated_at: new Date().toISOString() };
  if (body.data.saved !== undefined) row.saved = body.data.saved;
  if (body.data.dismissed !== undefined) {
    row.dismissed = body.data.dismissed;
    row.dismiss_reason = body.data.dismissed ? (body.data.reason ?? null) : null;
  }
  const { error } = await auth.supabase.from("user_offers").upsert(row);
  if (error) return NextResponse.json({ error: "Action impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
