import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { STAGES } from "@/lib/domain/application";

const Body = z.object({
  offerId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  url: z.string().url().max(2000).nullable().optional(),
  stage: z.enum(STAGES).default("postule"),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Candidature invalide");

  const { offerId, title, company, url, stage } = body.data;
  const row = {
    user_id: auth.user.id,
    offer_id: offerId ?? null,
    title,
    company,
    url: url ?? null,
    stage,
    applied_at: stage === "a_postuler" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const query = offerId
    ? auth.supabase.from("applications").upsert(row, { onConflict: "user_id,offer_id" })
    : auth.supabase.from("applications").insert(row);
  const { data, error } = await query.select("id").single();
  if (error) return NextResponse.json({ error: "Ajout au suivi impossible" }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
