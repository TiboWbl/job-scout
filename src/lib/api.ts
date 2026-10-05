import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";

type Authed = { supabase: Awaited<ReturnType<typeof getUser>>["supabase"]; user: User };

export async function requireUser(): Promise<Authed | NextResponse> {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  return { supabase, user };
}

export async function requireAdmin(): Promise<Authed | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!isAdminEmail(auth.user.email)) return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  return auth;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
