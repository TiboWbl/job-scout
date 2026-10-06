import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application } from "@/lib/domain/application";

export type BoardItem = Application & { domain: string | null; brand: string | null; accent: string | null };

export async function loadBoard(db: SupabaseClient, userId: string): Promise<BoardItem[]> {
  const { data } = await db
    .from("applications")
    .select("id, offer_id, title, company, url, stage, applied_at, notes, contact, interview_at, followed_up_at, origin, created_at, updated_at, offer:offers(company:companies(domain, brand, accent_color))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  type Row = Application & { offer: { company: { domain: string | null; brand: string | null; accent_color: string | null } | null } | null };
  return ((data ?? []) as unknown as Row[]).map(({ offer, ...a }) => ({
    ...a,
    domain: offer?.company?.domain ?? null,
    brand: offer?.company?.brand ?? null,
    accent: offer?.company?.accent_color ?? null,
  }));
}
