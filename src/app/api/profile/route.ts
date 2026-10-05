import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { Criteria, CvSummary, hasMinimumCriteria } from "@/lib/domain/criteria";

const Body = z.object({
  criteria: Criteria,
  searchText: z.string().max(6000).optional(),
  cvSummary: CvSummary.nullable().optional(),
});

// Saving bumps the profile version: every active offer gets re-scored against the new criteria.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Critères invalides");
  if (!hasMinimumCriteria(body.data.criteria)) return badRequest("Indique au moins un métier et un lieu.");

  const { supabase, user } = auth;
  const { data: current } = await supabase.from("profiles").select("criteria_version, onboarded_at").eq("id", user.id).single();
  const update: Record<string, unknown> = {
    criteria: body.data.criteria,
    criteria_version: (current?.criteria_version ?? 0) + 1,
    onboarded_at: current?.onboarded_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (body.data.searchText !== undefined) update.search_text = body.data.searchText;
  if (body.data.cvSummary !== undefined) update.cv_summary = body.data.cvSummary;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  return NextResponse.json({ ok: true, version: update.criteria_version });
}
