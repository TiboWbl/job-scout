import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { STAGES } from "@/lib/domain/application";

const isoOrNull = z.string().datetime({ offset: true }).nullable().optional();
const Body = z.object({
  stage: z.enum(STAGES).optional(),
  notes: z.string().max(4000).optional(),
  contact: z.string().max(300).optional(),
  applied_at: isoOrNull,
  interview_at: isoOrNull,
  followed_up_at: isoOrNull,
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Requête invalide");

  const update: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.stage && body.data.stage !== "a_postuler") {
    const { data } = await auth.supabase.from("applications").select("applied_at").eq("id", id).single();
    if (!data?.applied_at) update.applied_at = new Date().toISOString();
  }
  const { error } = await auth.supabase.from("applications").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { error } = await auth.supabase.from("applications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
