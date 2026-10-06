import { Board } from "@/app/(app)/suivi/board";
import { demoContext } from "@/lib/demo-page";
import { loadBoard } from "@/lib/views/board";

export const metadata = { title: "Suivi (démo)" };

export default async function DemoSuiviPage() {
  const { db, userId } = await demoContext();
  return <Board items={await loadBoard(db, userId)} demo base="/demo" />;
}
