import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";

const Body = z.object({ field: z.enum(["niveau", "metier", "experience", "salaire", "contrat", "lieu", "autre"]), comment: z.string().trim().max(500).optional() });

// Something Scout shows about this offer is wrong: kept for the admin, who fixes the rule behind it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Signalement invalide." }, { status: 400 });
  const { error } = await auth.supabase
    .from("offer_reports")
    .upsert({ offer_id: id, user_id: auth.user.id, field: body.data.field, comment: body.data.comment || null, resolved_at: null, created_at: new Date().toISOString() }, { onConflict: "offer_id,user_id,field" });
  if (error) return NextResponse.json({ error: "Le signalement n'est pas passé, réessaie." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
