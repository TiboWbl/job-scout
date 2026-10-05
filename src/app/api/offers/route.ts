import { NextResponse } from "next/server";
import { fetchFranceTravailOffers } from "@/lib/sources/france-travail";
import { fetchAdzunaOffers } from "@/lib/sources/adzuna";
import { fetchCompanyBoardOffers } from "@/lib/sources/company-boards";
import { Source } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const [franceTravail, adzuna, companyBoards] = await Promise.all([
    fetchFranceTravailOffers(),
    fetchAdzunaOffers(),
    fetchCompanyBoardOffers(),
  ]);

  const activeSources: Source[] = ["Page carrière"];
  if (process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET) {
    activeSources.push("France Travail");
  }
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    activeSources.push("Adzuna");
  }

  return NextResponse.json({
    offers: [...companyBoards, ...franceTravail, ...adzuna],
    activeSources,
    fetchedAt: new Date().toISOString(),
  });
}
