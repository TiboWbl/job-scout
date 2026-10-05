import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireUser } from "@/lib/api";
import { redactPersonalData } from "@/lib/privacy/redact";
import { extractCvSummary, interpretSearch } from "@/lib/profile/interpret";

export const maxDuration = 60;

const Body = z.object({ text: z.string().max(6000).default(""), cvText: z.string().max(60_000).optional() });

// Turns free text (+ optional CV) into editable criteria. Saves nothing.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Requête invalide");
  if (!body.data.text.trim() && !body.data.cvText?.trim()) return badRequest("Décris ce que tu cherches ou ajoute ton CV.");

  const meta = auth.user.user_metadata ?? {};
  const knownNames = [meta.full_name, meta.name, meta.given_name, meta.family_name].filter((n): n is string => typeof n === "string");
  const cvSummary = body.data.cvText?.trim() ? await extractCvSummary(redactPersonalData(body.data.cvText, knownNames)) : null;
  const { criteria, source } = await interpretSearch(body.data.text, cvSummary);
  return NextResponse.json({ criteria, cvSummary, source });
}
