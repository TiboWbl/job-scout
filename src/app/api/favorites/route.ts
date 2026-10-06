import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { resolveCompany } from "@/lib/collect/resolve";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Up to 8 entries per call: the client sends a long list in chunks and shows the progress.
const Body = z.object({ entries: z.array(z.string().trim().min(2).max(300)).min(1).max(8) });

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { data } = await auth.supabase
    .from("favorite_companies")
    .select("input, created_at, company:companies(id, name, domain, brand, ats)")
    .order("created_at", { ascending: false });
  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Liste invalide.");

  // The shared directory is written with the service role; the favourite itself stays the user's (RLS).
  const admin = createAdminClient();
  const results = await Promise.all(
    body.data.entries.map(async (input) => {
      try {
        const r = await resolveCompany(admin, input);
        const { error } = await auth.supabase.from("favorite_companies").upsert({ user_id: auth.user.id, company_id: r.companyId, input });
        return error ? { input, error: true } : { input, name: r.name, found: r.found, offers: r.offers };
      } catch {
        return { input, error: true };
      }
    }),
  );
  return NextResponse.json({ results });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const id = (await request.json().catch(() => null))?.companyId;
  if (typeof id !== "string") return badRequest("Entreprise manquante.");
  await auth.supabase.from("favorite_companies").delete().eq("company_id", id);
  return NextResponse.json({ ok: true });
}
