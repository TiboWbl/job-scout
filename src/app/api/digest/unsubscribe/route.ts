import { NextResponse } from "next/server";
import { isUnsubscribeToken } from "@/lib/digest";
import { createAdminClient } from "@/lib/supabase/admin";

// Turns the crush email off without signing in: the signed link of the email is the proof. POST only,
// so a mail scanner opening links never unsubscribes anyone. The mail app's one-click button posts here
// too ("List-Unsubscribe=One-Click"); the page's button gets sent back to the page.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(u) || !isUnsubscribeToken(u, t)) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  await createAdminClient().from("profiles").update({ email_digest: false }).eq("id", u);
  const form = await request.formData().catch(() => null);
  if (form?.get("List-Unsubscribe") === "One-Click") return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/desabonnement?fait=1", request.url), 303);
}
