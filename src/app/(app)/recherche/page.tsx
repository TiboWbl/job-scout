import { Criteria } from "@/lib/domain/criteria";
import { getUser } from "@/lib/supabase/server";
import { SearchSetup } from "@/components/search-setup";

export default async function RecherchePage() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria, search_text").eq("id", user!.id).single();
  const parsed = Criteria.safeParse(profile?.criteria ?? {});

  return (
    <div className="max-w-5xl px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Ma recherche</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">Modifie tes critères directement, ou redis ta recherche avec tes mots pour repartir d&apos;une nouvelle analyse.</p>
      <div className="mt-8">
        <SearchSetup mode="edit" initialText={profile?.search_text ?? ""} initialCriteria={parsed.success ? parsed.data : null} />
      </div>
    </div>
  );
}
