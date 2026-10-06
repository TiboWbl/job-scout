import { Feed } from "@/app/(app)/offres/feed";
import { demoContext } from "@/lib/demo-page";
import { loadFeed } from "@/lib/views/feed";

export default async function DemoOffresPage({ searchParams }: { searchParams: Promise<{ offre?: string }> }) {
  const { offre } = await searchParams;
  const { db, userId } = await demoContext();
  const data = await loadFeed(db, userId);
  // Visitors never start a sort (no model call): the scheduled job sorts for the persona.
  return <Feed {...data} pending={0} initialOpenId={offre ?? null} isAdmin={false} demo base="/demo" />;
}
