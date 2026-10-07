import { NextResponse } from "next/server";
import { requestCollection } from "@/lib/collect/dispatch";

// Vercel Cron, between 5 h and 6 h and between 17 h and 18 h in Paris (the Hobby plan fires within the hour): starts the full collection (then the sort) on GitHub Actions,
// whose own schedule is sometimes late or skipped. Offers are ready before the person opens Scout.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without that secret configured, nothing runs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = await requestCollection();
  return NextResponse.json({ started });
}
