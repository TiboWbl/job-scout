import Link from "next/link";
import { marketTop } from "@/lib/market/view";
import { notFound } from "next/navigation";
import { Results, type HistoryRow } from "@/app/(app)/cv/cv-check";
import { demoContext } from "@/lib/demo-page";

export const metadata = { title: "Analyse de CV (démo)" };

export default async function DemoAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId } = await demoContext();
  const { data } = await db.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison, recruiter").eq("id", id).eq("user_id", userId).maybeSingle();
  const h = data as HistoryRow | null;
  if (!h?.result) notFound();
  const marketKeywords = (await marketTop(db, userId)).map((t) => t.name);
  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <Link href="/demo/cv" className="btn-soft">
        ← Mon CV
      </Link>
      <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">Analyse du {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</h1>
      <Results analysis={{ id: h.id, createdAt: h.created_at, filename: h.filename, result: h.result, suggestions: h.suggestions ?? [], comparison: h.comparison, recruiter: h.recruiter ?? null, text: null }} pdfUrl={null} marketKeywords={marketKeywords} />
    </div>
  );
}
