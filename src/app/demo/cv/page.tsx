import { CvCheck } from "@/app/(app)/cv/cv-check";
import { demoContext } from "@/lib/demo-page";
import { loadCvPage } from "@/lib/views/cv";

export const metadata = { title: "Mon CV (démo)" };

// The same page as in the app, on Camille's fictional CV: her saved analysis opens at once.
export default async function DemoCvPage() {
  const { db, userId } = await demoContext();
  const { history, offers } = await loadCvPage(db, userId);
  return <CvCheck history={history} offers={offers} initialOfferId={null} demo />;
}
