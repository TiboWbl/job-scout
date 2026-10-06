import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseEnv } from "@/lib/env";

// Acts as the signed-in user: every query goes through row-level security.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes them.
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string | undefined; user_metadata: Record<string, unknown> };

// Verified from the signed session token (no round trip to the auth server when the project uses
// asymmetric signing keys), and computed once per request even if layout and page both ask.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user: SessionUser | null = claims?.sub
    ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined, user_metadata: (claims.user_metadata as Record<string, unknown>) ?? {} }
    : null;
  return { supabase, user };
});
