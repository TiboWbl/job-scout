import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Invited = the admin, an address in INVITED_EMAILS, or one added from the admin page.
export async function isInvited(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  const target = normalizeEmail(email);
  const fromEnv = (process.env.INVITED_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  if (fromEnv.includes(target)) return true;
  const { data } = await createAdminClient().from("invitations").select("email").eq("email", target).maybeSingle();
  return Boolean(data);
}
