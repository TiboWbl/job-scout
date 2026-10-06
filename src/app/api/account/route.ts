import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { normalizeEmail } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes the account and everything attached to it, at once and for good. Profile, scores, actions,
// applications and favourites cascade from the auth user; the invitation (an email) goes too.
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return NextResponse.json({ error: "La suppression n'a pas abouti, réessaie." }, { status: 500 });
  if (auth.user.email) await admin.from("invitations").delete().eq("email", normalizeEmail(auth.user.email));
  return NextResponse.json({ ok: true });
}
