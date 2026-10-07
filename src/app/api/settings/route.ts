import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";

const Body = z.object({ emailDigest: z.boolean() });

// The person's own settings (RLS: only their row).
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Réglage invalide");
  const { error } = await auth.supabase.from("profiles").update({ email_digest: body.data.emailDigest }).eq("id", auth.user.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
