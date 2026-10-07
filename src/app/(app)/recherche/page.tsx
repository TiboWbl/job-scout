import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getUser } from "@/lib/supabase/server";
import { SearchSetup } from "@/components/search-setup";

export const metadata = { title: "Ma recherche" };

export default async function RecherchePage() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria, search_text, cv_summary, cv_filename, cv_updated_at").eq("id", user!.id).single();
  const parsed = Criteria.safeParse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary);

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Ma recherche</h1>
      <div className="mt-8">
        <SearchSetup mode="edit" initialText={profile?.search_text ?? ""} initialCriteria={parsed.success ? parsed.data : null} initialCvSummary={cv.success ? cv.data : null}
          savedCv={cv.success ? { filename: profile?.cv_filename ?? null, updatedAt: profile?.cv_updated_at ?? null } : null}
        />
      </div>
    </div>
  );
}
