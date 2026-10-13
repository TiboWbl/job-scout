import { CompaniesView } from "@/components/companies-view";
import { demoContext } from "@/lib/demo-page";

export const metadata = { title: "Entreprises (démo)" };

export default async function DemoEntreprisesPage() {
  const { db, userId } = await demoContext();
  return <CompaniesView db={db} userId={userId} base="/demo" demo />;
}
