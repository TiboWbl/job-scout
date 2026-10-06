import { NextResponse } from "next/server";
import { getUser, type SessionUser } from "@/lib/supabase/server";
import { isInvited } from "@/lib/access";
import { isAdminEmail } from "@/lib/env";

type Authed = { supabase: Awaited<ReturnType<typeof getUser>>["supabase"]; user: SessionUser };

// Every user route goes through here, so nobody uninvited can spend the LLM quota.
export async function requireUser(): Promise<Authed | NextResponse> {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  if (!(await isInvited(user.email))) return NextResponse.json({ error: "Accès sur invitation" }, { status: 403 });
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
