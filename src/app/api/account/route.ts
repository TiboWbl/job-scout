import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes the account and everything attached to it, at once and for good. Profile, scores, actions,
// applications and favourites cascade from the auth user. The invitation stays: the person keeps
// the right to come back (the admin can remove it from the admin page).
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return NextResponse.json({ error: "La suppression n'a pas abouti, réessaie." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
