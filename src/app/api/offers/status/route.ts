import { NextRequest, NextResponse } from "next/server";
import { checkFranceTravailOfferStatus } from "@/lib/sources/france-travail";
import { OfferStatus } from "@/lib/types";

// Only France Travail offers can be reliably rechecked (it has a documented single-offer
// endpoint). Adzuna has no equivalent in its public API, and probing arbitrary third-party
// redirect URLs isn't something we have a legal basis to automate — those offers stay "unknown"
// rather than risk a wrong "pourvu" label.
export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  const statuses: Record<string, OfferStatus> = {};

  await Promise.all(
    ids.map(async (id) => {
      if (id.startsWith("france-travail-")) {
        statuses[id] = await checkFranceTravailOfferStatus(id.replace("france-travail-", ""));
      } else {
        statuses[id] = "unknown";
      }
    }),
  );

  return NextResponse.json({ statuses });
}
