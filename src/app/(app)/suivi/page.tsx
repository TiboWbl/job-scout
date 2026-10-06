import type { Application } from "@/lib/domain/application";
import { getUser } from "@/lib/supabase/server";
import { Board, type BoardItem } from "./board";

export default async function SuiviPage() {
  const { supabase } = await getUser();
  const { data } = await supabase
    .from("applications")
    .select("id, offer_id, title, company, url, stage, applied_at, notes, contact, interview_at, followed_up_at, origin, created_at, updated_at, offer:offers(company:companies(domain, brand, accent_color))")
    .order("updated_at", { ascending: false });

  type Row = Application & { offer: { company: { domain: string | null; brand: string | null; accent_color: string | null } | null } | null };
  const items: BoardItem[] = ((data ?? []) as unknown as Row[]).map(({ offer, ...a }) => ({
    ...a,
    domain: offer?.company?.domain ?? null,
    brand: offer?.company?.brand ?? null,
    accent: offer?.company?.accent_color ?? null,
  }));

  return <Board items={items} />;
}
