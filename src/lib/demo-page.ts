import { notFound } from "next/navigation";
import { getDemoUserId } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

// Demo pages read the persona's data with the service role: read-only, nothing a visitor does is saved.
export async function demoContext() {
  const db = createAdminClient();
  const userId = await getDemoUserId(db);
  if (!userId) notFound();
  return { db, userId };
}
