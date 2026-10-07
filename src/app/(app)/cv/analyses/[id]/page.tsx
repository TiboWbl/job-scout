import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Results, type HistoryRow } from "../../cv-check";

export const metadata = { title: "Analyse de CV" };

// One saved analysis, on its own page: the grid, the recruiter's reading, the rewrites. The CV itself
// was never kept, so there is no "what an ATS sees" view here.
export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getUser();
  const { data } = await supabase.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison, recruiter").eq("id", id).maybeSingle();
  const h = data as HistoryRow | null;
  if (!h?.result) notFound();
  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <Link href="/cv" className="btn-soft">
        ← Mon CV
      </Link>
      <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">Analyse du {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</h1>
      <Results analysis={{ id: h.id, createdAt: h.created_at, filename: h.filename, result: h.result, suggestions: h.suggestions ?? [], comparison: h.comparison, recruiter: h.recruiter ?? null, text: null }} pdfUrl={null} />
    </div>
  );
}
