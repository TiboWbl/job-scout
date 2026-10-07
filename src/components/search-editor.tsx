import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { getUser } from "@/lib/supabase/server";
import { SearchSetup } from "@/components/search-setup";

// The person's search, editable: what they wrote, their CV, the criteria understood from it.
export async function SearchEditor() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("criteria, search_text, cv_summary, cv_filename, cv_updated_at").eq("id", user!.id).single();
  const parsed = Criteria.safeParse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary);
  return (
    <SearchSetup
      mode="edit"
      initialText={profile?.search_text ?? ""}
      initialCriteria={parsed.success ? parsed.data : null}
      initialCvSummary={cv.success ? cv.data : null}
      savedCv={cv.success ? { filename: profile?.cv_filename ?? null, updatedAt: profile?.cv_updated_at ?? null } : null}
    />
  );
}
