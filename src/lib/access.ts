import { cache } from "react";
import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Accounts open to anyone up to this number (OPEN_SIGNUP_LIMIT, 10 by default while Scout is tested
// for real; 0 closes sign-up): the free model and database quotas are shared by everyone.
export function openSignupLimit() {
  const n = Number(process.env.OPEN_SIGNUP_LIMIT ?? 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

// Allowed = the admin, an invited address (INVITED_EMAILS or the admin page), or one of the first
// accounts while sign-up is open.
export const isInvited = cache(async (email: string | null | undefined, userId?: string): Promise<boolean> => {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  const target = normalizeEmail(email);
  const fromEnv = (process.env.INVITED_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  if (fromEnv.includes(target)) return true;
  const db = createAdminClient();
  const { data } = await db.from("invitations").select("email").eq("email", target).maybeSingle();
  if (data) return true;
  const limit = openSignupLimit();
  if (!userId || limit === 0) return false;
  const { data: me } = await db.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  if (!me) return false;
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("is_demo", false).lte("created_at", me.created_at);
  return (count ?? Infinity) <= limit;
});
