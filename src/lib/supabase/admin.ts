import { createClient } from "@supabase/supabase-js";
import { serviceRoleKey, supabaseEnv } from "@/lib/env";

// Bypasses row-level security. Server-side only, for shared data (offers, companies, source health).
export function createAdminClient() {
  const { url } = supabaseEnv();
  return createClient(url, serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
