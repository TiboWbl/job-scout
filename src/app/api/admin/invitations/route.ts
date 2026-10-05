import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/access";
import { badRequest, requireAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readEmail(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  return EMAIL.test(email) ? email : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const email = await readEmail(request);
  if (!email) return badRequest("Adresse email invalide.");
  const { error } = await createAdminClient().from("invitations").upsert({ email });
  if (error) return NextResponse.json({ error: "L'invitation n'a pas été enregistrée." }, { status: 500 });
  return NextResponse.json({ email });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const email = await readEmail(request);
  if (!email) return badRequest("Adresse email invalide.");
  await createAdminClient().from("invitations").delete().eq("email", email);
  return NextResponse.json({ email });
}
