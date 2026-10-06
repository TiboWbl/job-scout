import { TodayView } from "@/components/today-view";
import { demoContext } from "@/lib/demo-page";

export const metadata = { title: "Démo" };

export default async function DemoTodayPage() {
  const { db, userId } = await demoContext();
  return <TodayView db={db} userId={userId} base="/demo" />;
}
