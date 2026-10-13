import { CompaniesView } from "@/components/companies-view";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Entreprises" };

export default async function EntreprisesPage() {
  const { supabase, user } = await getUser();
  return <CompaniesView db={supabase} userId={user!.id} />;
}
